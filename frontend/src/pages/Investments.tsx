import { createResource, createSignal, For, Show } from "solid-js";
import { Plus, TrendingUp, Calendar, Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-solid";
import { api } from "../lib/api";
import { formatCurrency, numericToFloat, pgDateToString } from "../lib/format";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { Badge } from "../components/ui/badge";
import { SkeletonBlock } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";
import { Sheet } from "../components/ui/sheet";
import { InvestmentForm } from "../components/forms/investment-form";

interface Holding {
  id: string;
  name: string;
  asset_type: string;
  currency: string;
  quantity: unknown;       // pgtype.Numeric
  buy_price: unknown;      // pgtype.Numeric
  current_price: unknown;  // pgtype.Numeric
  interest_rate: unknown;  // pgtype.Numeric
  compounding_frequency: { CompoundingFrequency: string; Valid: boolean };
  computed_value: unknown; // pgtype.Numeric
  maturity_date: unknown;  // pgtype.Date
}

interface InvestmentTransaction {
  id: string;
  type: string;
  amount: unknown;
  quantity: unknown;
  price: unknown;
  date: string;
  note: string;
}

function compoundingLabel(cf: { CompoundingFrequency: string; Valid: boolean } | undefined): string {
  if (!cf || !cf.Valid) return "";
  switch (cf.CompoundingFrequency) {
    case "monthly": return "Monthly";
    case "quarterly": return "Quarterly";
    case "semi_annual": return "Semi-Annual";
    case "annual": return "Annual";
    default: return cf.CompoundingFrequency;
  }
}

function InvestmentTransactions(props: { investmentId: string; currency: string }) {
  const [txns, { refetch }] = createResource(
    () => props.investmentId,
    (id) => api.get<InvestmentTransaction[]>(`/v1/investments/${id}/transactions`).catch(() => [] as InvestmentTransaction[])
  );
  const [showForm, setShowForm] = createSignal(false);
  const [txType, setTxType] = createSignal("buy");
  const [txAmount, setTxAmount] = createSignal("");
  const [txQuantity, setTxQuantity] = createSignal("");
  const [txPrice, setTxPrice] = createSignal("");
  const [txNote, setTxNote] = createSignal("");
  const [txDate, setTxDate] = createSignal(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = createSignal(false);

  async function handleAdd(e: SubmitEvent) {
    e.preventDefault();
    if (!txAmount() || !txDate()) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        type: txType(),
        amount: parseFloat(txAmount()),
        date: txDate(),
        ...(txQuantity() ? { quantity: parseFloat(txQuantity()) } : {}),
        ...(txPrice() ? { price: parseFloat(txPrice()) } : {}),
        ...(txNote() ? { note: txNote() } : {}),
      };
      await api.post(`/v1/investments/${props.investmentId}/transactions`, body);
      setTxAmount("");
      setTxQuantity("");
      setTxPrice("");
      setTxNote("");
      setShowForm(false);
      refetch();
    } catch {
      alert("Failed to add transaction.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div class="mt-3 border-t border-surface-hover pt-3 space-y-2">
      <div class="flex items-center justify-between mb-1">
        <span class="text-[12px] font-body font-medium text-muted uppercase tracking-wide">Transactions</span>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          class="text-[12px] text-primary font-medium hover:underline"
        >
          {showForm() ? "Cancel" : "+ Add"}
        </button>
      </div>
      <Show when={showForm()}>
        <form onSubmit={handleAdd} class="flex flex-wrap gap-2 items-end bg-bg rounded-input p-2">
          <select
            value={txType()}
            onChange={(e) => setTxType(e.currentTarget.value)}
            class="text-sm border border-surface-hover rounded-input px-2 py-1 bg-bg text-text"
          >
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
            <option value="dividend">Dividend</option>
            <option value="interest">Interest</option>
            <option value="bonus">Bonus</option>
          </select>
          <input
            type="number"
            placeholder="Amount"
            step="0.01"
            required
            value={txAmount()}
            onInput={(e) => setTxAmount(e.currentTarget.value)}
            class="text-sm border border-surface-hover rounded-input px-2 py-1 bg-bg text-text w-28"
          />
          <input
            type="number"
            placeholder="Quantity"
            step="any"
            value={txQuantity()}
            onInput={(e) => setTxQuantity(e.currentTarget.value)}
            class="text-sm border border-surface-hover rounded-input px-2 py-1 bg-bg text-text w-24"
          />
          <input
            type="number"
            placeholder="Price per unit"
            step="0.01"
            value={txPrice()}
            onInput={(e) => setTxPrice(e.currentTarget.value)}
            class="text-sm border border-surface-hover rounded-input px-2 py-1 bg-bg text-text w-28"
          />
          <input
            type="text"
            placeholder="Note"
            value={txNote()}
            onInput={(e) => setTxNote(e.currentTarget.value)}
            class="text-sm border border-surface-hover rounded-input px-2 py-1 bg-bg text-text w-36"
          />
          <input
            type="date"
            value={txDate()}
            onInput={(e) => setTxDate(e.currentTarget.value)}
            class="text-sm border border-surface-hover rounded-input px-2 py-1 bg-bg text-text"
          />
          <button
            type="submit"
            disabled={submitting()}
            class="text-sm px-3 py-1 rounded-input bg-primary text-bg font-medium hover:opacity-90 disabled:opacity-50"
          >
            {submitting() ? "…" : "Add"}
          </button>
        </form>
      </Show>
      <Show when={txns.loading}>
        <p class="text-xs text-muted">Loading…</p>
      </Show>
      <Show when={!txns.loading && (txns() ?? []).length === 0}>
        <p class="text-xs text-muted">No transactions yet.</p>
      </Show>
      <For each={txns() ?? []}>
        {(t) => (
          <div class="flex items-center justify-between text-sm py-1">
            <div class="flex items-center gap-2">
              <Badge variant="outline" class="text-[11px] uppercase">{t.type}</Badge>
              <span class="text-muted text-xs">{t.date}</span>
            </div>
            <span class="font-mono text-text">{formatCurrency(numericToFloat(t.amount), props.currency)}</span>
          </div>
        )}
      </For>
    </div>
  );
}

export default function Investments() {
  const [holdings, { refetch }] = createResource(() => api.get<Holding[]>("/v1/investments"));
  const [sheetOpen, setSheetOpen] = createSignal(false);
  const [editHolding, setEditHolding] = createSignal<Holding | null>(null);
  const [editSheetOpen, setEditSheetOpen] = createSignal(false);
  const [expandedId, setExpandedId] = createSignal<string | null>(null);

  function handleSuccess() {
    setSheetOpen(false);
    refetch();
  }
  function closeEdit() {
    setEditSheetOpen(false);
    setEditHolding(null);
  }
  function handleEditSuccess() {
    closeEdit();
    refetch();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await api.delete(`/v1/investments/${id}`);
      refetch();
    } catch {
      alert("Failed to delete investment.");
    }
  }

  function toggleExpand(id: string) {
    setExpandedId((cur) => cur === id ? null : id);
  }

  return (
    <>
      <PageHeader title="Investments" actions={
        <button
          type="button"
          aria-label="Add investment"
          onClick={() => setSheetOpen(true)}
          class="w-10 h-10 flex items-center justify-center rounded-full bg-surface text-text active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <Plus size={20} />
        </button>
      } />
      <div class="p-4 md:p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <Show when={holdings.loading}>
            <SkeletonBlock class="min-h-[120px]" />
            <SkeletonBlock class="min-h-[120px]" />
          </Show>
          <Show when={holdings.error}>
            <div class="col-span-1 md:col-span-2 lg:col-span-3">
              <p class="text-accent text-sm py-6 text-center">Failed to load investments.</p>
            </div>
          </Show>
          <Show when={!holdings.loading && !holdings.error && (holdings() ?? []).length === 0}>
            <div class="col-span-1 md:col-span-2 lg:col-span-3">
              <EmptyState
                icon={TrendingUp}
                title="No investments yet"
                body="Track your portfolio across stocks, ETFs, and funds."
                action={{ label: "Add holding", onClick: () => setSheetOpen(true) }}
              />
            </div>
          </Show>
          <For each={holdings() ?? []}>
            {(h) => {
              const qty = numericToFloat(h.quantity);
              const price = numericToFloat(h.current_price);
              const buyPrice = numericToFloat(h.buy_price);
              const marketValue = qty * price;
              const gain = price - buyPrice;
              const gainPct = buyPrice > 0 ? ((gain / buyPrice) * 100) : 0;
              const rate = numericToFloat(h.interest_rate);
              const computed = numericToFloat(h.computed_value);
              const maturityStr = pgDateToString(h.maturity_date);
              const isExpanded = () => expandedId() === h.id;
              return (
                <div class="group relative">
                  <BentoBlock variant="pressable">
                    <div class="flex items-start gap-3">
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between">
                          <span class="font-display text-lg font-bold text-text truncate">{h.name}</span>
                          <span class="font-mono text-xs text-muted uppercase ml-2 flex-shrink-0">{h.asset_type}</span>
                        </div>
                        <div class="font-mono text-sm text-muted mt-0.5">{qty} units @ {formatCurrency(price, h.currency)}</div>
                        <Show when={computed > 0}>
                          <div class="font-mono text-xs text-muted mt-0.5">computed: {formatCurrency(computed, h.currency)}</div>
                        </Show>
                        <div class="flex items-center justify-between mt-2">
                          <span class="font-display text-lg font-bold text-text">{formatCurrency(marketValue, h.currency)}</span>
                          <Show when={buyPrice > 0}>
                            <span class={`text-sm font-medium ${gainPct >= 0 ? "text-primary" : "text-accent"}`}>
                              {gainPct >= 0 ? "+" : ""}{gainPct.toFixed(1)}%
                            </span>
                          </Show>
                        </div>
                        <div class="flex flex-wrap items-center gap-1.5 mt-2">
                          <Show when={rate > 0}>
                            <Badge variant="outline" class="font-mono">{rate.toFixed(2)}% p.a.</Badge>
                          </Show>
                          <Show when={compoundingLabel(h.compounding_frequency)}>
                            <span class="font-mono text-[11px] text-muted uppercase">{compoundingLabel(h.compounding_frequency)}</span>
                          </Show>
                          <Show when={maturityStr}>
                            <Badge variant="outline" class="font-mono inline-flex items-center gap-1">
                              <Calendar size={10} /> {maturityStr}
                            </Badge>
                          </Show>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleExpand(h.id)}
                          class="mt-2 flex items-center gap-1 text-xs text-muted hover:text-text transition-colors"
                        >
                          {isExpanded() ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          {isExpanded() ? "Hide transactions" : "View transactions"}
                        </button>
                        <Show when={isExpanded()}>
                          <InvestmentTransactions investmentId={h.id} currency={h.currency} />
                        </Show>
                      </div>
                    </div>
                  </BentoBlock>
                  <div class="absolute top-3 right-3 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setEditHolding(h); setEditSheetOpen(true); }}
                      aria-label={`Edit ${h.name}`}
                      class="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-hover text-muted hover:text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDelete(h.id, h.name); }}
                      aria-label={`Delete ${h.name}`}
                      class="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-hover text-muted hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </div>

      <Sheet open={sheetOpen()} onClose={() => setSheetOpen(false)} title="Add Investment">
        <InvestmentForm onSuccess={handleSuccess} onClose={() => setSheetOpen(false)} />
      </Sheet>

      <Sheet open={editSheetOpen()} onClose={closeEdit} title="Edit Investment">
        <Show when={editHolding()}>
          {(h) => (
            <InvestmentForm
              existing={{
                id: h().id,
                name: h().name,
                asset_type: h().asset_type,
                currency: h().currency,
                quantity: h().quantity,
                buy_price: h().buy_price,
                current_price: h().current_price,
                interest_rate: h().interest_rate,
                compounding_frequency: h().compounding_frequency,
                maturity_date: h().maturity_date,
              }}
              onSuccess={handleEditSuccess}
              onClose={closeEdit}
            />
          )}
        </Show>
      </Sheet>
    </>
  );
}
