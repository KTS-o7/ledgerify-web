import { createResource, createSignal, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { TrendingUp, Calendar, ArrowRight } from "lucide-solid";
import { api } from "../lib/api";
import { numericToFloat, pgDateToString } from "../lib/format";
import { cn } from "../lib/utils";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { SkeletonBlock, SkeletonRow } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";
import { Sheet } from "../components/ui/sheet";
import { Eyebrow } from "../components/ui/eyebrow";
import { Money } from "../components/ui/money";
import { NumberRoll } from "../components/ui/number-roll";
import { InvestmentForm } from "../components/forms/investment-form";
import { WealthTabs } from "../components/wealth/WealthTabs";
import { AddButton, DisclosureButton, RowActions, inlineField, pct, shortDate } from "../components/wealth/common";
import { nextDebit, type SipSummary } from "../components/wealth/sip";

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

const ASSET_LABEL: Record<string, string> = {
  stock: "Stock", mf: "Mutual fund", crypto: "Crypto", fd: "Fixed deposit", ppf: "PPF", nps: "NPS",
  gold: "Gold", silver: "Silver", real_estate: "Real estate", savings: "Savings", other: "Other",
};

function compoundingLabel(cf: { CompoundingFrequency: string; Valid: boolean } | undefined): string {
  if (!cf || !cf.Valid) return "";
  switch (cf.CompoundingFrequency) {
    case "monthly": return "monthly";
    case "quarterly": return "quarterly";
    case "semi_annual": return "semi-annual";
    case "annual": return "annual";
    default: return cf.CompoundingFrequency;
  }
}

/** Current value, cost and return for one holding. */
function holdingFigures(h: Holding) {
  const qty = numericToFloat(h.quantity);
  const buy = numericToFloat(h.buy_price);
  const price = numericToFloat(h.current_price);
  const computed = numericToFloat(h.computed_value);
  const value = computed > 0 ? computed : qty * price;
  const invested = qty > 0 && buy > 0 ? qty * buy : 0;
  const ret = invested > 0 ? value - invested : 0;
  return { qty, buy, price, value, invested, ret, retPct: invested > 0 ? (ret / invested) * 100 : null };
}

function InvestmentTransactions(props: { investmentId: string; currency: string; id: string }) {
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
    <div id={props.id} class="mt-2 mb-3 rounded-[14px] bg-sunken p-3 flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <Eyebrow as="h3">Transactions</Eyebrow>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          aria-expanded={showForm()}
          class="text-[12.5px] text-signal font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal rounded"
        >
          {showForm() ? "Cancel" : "Add transaction"}
        </button>
      </div>
      <Show when={showForm()}>
        <form onSubmit={handleAdd} class="grid grid-cols-2 md:grid-cols-3 gap-2" aria-label="Add investment transaction">
          <select aria-label="Type" value={txType()} onChange={(e) => setTxType(e.currentTarget.value)} class={inlineField}>
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
            <option value="dividend">Dividend</option>
            <option value="interest">Interest</option>
            <option value="bonus">Bonus</option>
          </select>
          <input aria-label="Amount" type="number" placeholder="Amount" step="0.01" required value={txAmount()}
            onInput={(e) => setTxAmount(e.currentTarget.value)} class={cn(inlineField, "font-mono tabular")} />
          <input aria-label="Quantity" type="number" placeholder="Quantity" step="any" value={txQuantity()}
            onInput={(e) => setTxQuantity(e.currentTarget.value)} class={cn(inlineField, "font-mono tabular")} />
          <input aria-label="Price per unit" type="number" placeholder="Price per unit" step="0.01" value={txPrice()}
            onInput={(e) => setTxPrice(e.currentTarget.value)} class={cn(inlineField, "font-mono tabular")} />
          <input aria-label="Date" type="date" value={txDate()} onInput={(e) => setTxDate(e.currentTarget.value)} class={cn(inlineField, "font-mono tabular")} />
          <input aria-label="Note" type="text" placeholder="Note" value={txNote()} onInput={(e) => setTxNote(e.currentTarget.value)} class={inlineField} />
          <button
            type="submit"
            disabled={submitting()}
            class="col-span-2 md:col-span-3 h-9 rounded-[10px] bg-btn text-btn-text text-[13.5px] font-semibold hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            {submitting() ? "Saving…" : "Add"}
          </button>
        </form>
      </Show>
      <Show when={txns.loading}>
        <p class="text-[12.5px] text-muted">Loading…</p>
      </Show>
      <Show when={!txns.loading && (txns() ?? []).length === 0}>
        <p class="text-[12.5px] text-muted">No transactions yet.</p>
      </Show>
      <ul class="flex flex-col">
        <For each={txns() ?? []}>
          {(t) => (
            <li class="flex items-center justify-between gap-2 h-9 text-[13px]">
              <div class="flex items-center gap-2.5 min-w-0">
                <span class="font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted w-16">{t.type}</span>
                <span class="font-mono tabular text-[12px] text-muted">{shortDate(t.date)}</span>
              </div>
              <Money value={numericToFloat(t.amount)} currency={props.currency} />
            </li>
          )}
        </For>
      </ul>
    </div>
  );
}

export default function Investments() {
  const [holdings, { refetch }] = createResource(() => api.get<Holding[]>("/v1/investments"));
  const [sips] = createResource(() => api.get<SipSummary[]>("/v1/sips").catch(() => [] as SipSummary[]));
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

  // ── Portfolio summary (client-side aggregation) ────────────────────────
  const portfolio = () => {
    const list = holdings() ?? [];
    if (list.length === 0) return null;
    let invested = 0, value = 0, valueWithCost = 0;
    for (const h of list) {
      const f = holdingFigures(h);
      value += f.value;
      if (f.invested > 0) { invested += f.invested; valueWithCost += f.value; }
    }
    const gain = valueWithCost - invested;
    return { invested, value, gain, gainPct: invested > 0 ? (gain / invested) * 100 : 0 };
  };

  return (
    <>
      <PageHeader title="Investments" actions={<AddButton label="Add holding" onClick={() => setSheetOpen(true)} />} />
      <div class="px-5 md:px-7 py-5 md:py-6 flex flex-col gap-4">
        <WealthTabs />

        <Show when={holdings.loading}>
          <div class="grid grid-cols-2 gap-4">
            <SkeletonBlock class="h-[104px]" />
            <SkeletonBlock class="h-[104px]" />
          </div>
          <SkeletonRow />
          <SkeletonRow />
        </Show>

        <Show when={holdings.error}>
          <p class="text-neg text-[14px] py-6 text-center">Failed to load investments.</p>
        </Show>

        <Show when={!holdings.loading && portfolio()}>
          {(p) => (
            <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
              <BentoBlock class="flex flex-col gap-2">
                <Eyebrow>Current value</Eyebrow>
                <NumberRoll value={p().value} mutedSymbol class="text-[24px] md:text-[30px] leading-none tracking-[-0.04em]" />
              </BentoBlock>
              <BentoBlock class="flex flex-col gap-2">
                <Eyebrow>Total return</Eyebrow>
                <span class={cn("font-mono tabular text-[24px] md:text-[30px] leading-none tracking-[-0.04em]", p().gain >= 0 ? "text-pos" : "text-neg")}>
                  {p().gain >= 0 ? "+" : "−"}<Money value={Math.abs(p().gain)} tone={p().gain >= 0 ? "pos" : "neg"} />
                </span>
                <span class={cn("font-mono tabular text-[12px]", p().gain >= 0 ? "text-pos" : "text-neg")}>{pct(p().gainPct, 2)}</span>
              </BentoBlock>
              <BentoBlock class="hidden md:flex flex-col gap-2">
                <Eyebrow>Invested</Eyebrow>
                <Money value={p().invested} mutedSymbol class="text-[30px] leading-none tracking-[-0.04em]" />
              </BentoBlock>
            </div>
          )}
        </Show>

        <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          {/* Holdings list */}
          <Show when={!holdings.loading && !holdings.error}>
            <BentoBlock class={cn("p-0 overflow-hidden", (sips() ?? []).length > 0 ? "md:col-span-8" : "md:col-span-12")}>
              <div class="flex items-center justify-between px-5 h-12 border-b border-border">
                <Eyebrow as="h2">Holdings</Eyebrow>
                <span class="font-mono tabular text-[12px] text-muted">{(holdings() ?? []).length}</span>
              </div>
              <Show
                when={(holdings() ?? []).length > 0}
                fallback={
                  <EmptyState
                    icon={TrendingUp}
                    title="No holdings yet"
                    body="Track stocks, funds, deposits and gold in one place."
                    action={{ label: "Add holding", onClick: () => setSheetOpen(true) }}
                  />
                }
              >
                <ul class="divide-y divide-border">
                  <For each={holdings() ?? []}>
                    {(h) => {
                      const f = holdingFigures(h);
                      const rate = numericToFloat(h.interest_rate);
                      const maturity = pgDateToString(h.maturity_date);
                      const isExpanded = () => expandedId() === h.id;
                      const sub = () => {
                        const parts = [ASSET_LABEL[h.asset_type] ?? h.asset_type];
                        if (f.qty > 0 && f.price > 0) parts.push(`${f.qty} @ ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(f.price)}`);
                        if (rate > 0) parts.push(`${rate.toFixed(2)}% p.a.${compoundingLabel(h.compounding_frequency) ? " " + compoundingLabel(h.compounding_frequency) : ""}`);
                        return parts.join(" · ");
                      };
                      return (
                        <li class="group px-5">
                          <div class="flex items-center gap-3 min-h-[60px] py-2">
                            <div class="flex-1 min-w-0">
                              <div class="text-[14.5px] font-medium text-text truncate">{h.name}</div>
                              <div class="text-[12.5px] text-muted truncate mt-0.5">{sub()}</div>
                              <Show when={maturity}>
                                <div class="flex items-center gap-1 font-mono tabular text-[11.5px] text-faint mt-0.5">
                                  <Calendar size={11} aria-hidden="true" /> matures {shortDate(maturity)}
                                </div>
                              </Show>
                            </div>
                            <div class="text-right shrink-0">
                              <Money value={f.value} currency={h.currency} class="text-[14.5px]" />
                              <Show when={f.retPct !== null}>
                                <div class={cn("font-mono tabular text-[12px] mt-0.5", f.ret >= 0 ? "text-pos" : "text-neg")}>{pct(f.retPct!)}</div>
                              </Show>
                            </div>
                            <RowActions
                              name={h.name}
                              onEdit={() => { setEditHolding(h); setEditSheetOpen(true); }}
                              onDelete={() => handleDelete(h.id, h.name)}
                            />
                          </div>
                          <div class="-mt-1 mb-1.5">
                            <DisclosureButton open={isExpanded()} controls={`inv-tx-${h.id}`} onClick={() => setExpandedId((c) => (c === h.id ? null : h.id))}>
                              {isExpanded() ? "Hide transactions" : "Transactions"}
                            </DisclosureButton>
                          </div>
                          <Show when={isExpanded()}>
                            <InvestmentTransactions id={`inv-tx-${h.id}`} investmentId={h.id} currency={h.currency} />
                          </Show>
                        </li>
                      );
                    }}
                  </For>
                </ul>
              </Show>
            </BentoBlock>
          </Show>

          {/* SIP cards */}
          <Show when={(sips() ?? []).length > 0}>
            <section class="md:col-span-4 flex flex-col gap-3" aria-labelledby="sip-heading">
              <div class="flex items-center justify-between h-6">
                <Eyebrow as="h2"><span id="sip-heading">SIPs</span></Eyebrow>
                <A href="/sips" class="inline-flex items-center gap-1 text-[12.5px] font-medium">
                  Manage <ArrowRight size={13} />
                </A>
              </div>
              <For each={sips() ?? []}>
                {(s) => {
                  const next = nextDebit(s.start_date);
                  return (
                    <A href="/sips" class="block rounded-card bg-surface border border-border p-4 hover:bg-raised transition-colors duration-[160ms] !text-text" aria-label={`${s.name} SIP`}>
                      <div class="flex items-start justify-between gap-2">
                        <span class="text-[14.5px] font-medium truncate">{s.name}</span>
                        <span class="font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted shrink-0">{s.sip_type}</span>
                      </div>
                      <div class="mt-3 flex items-end justify-between gap-2">
                        <div>
                          <Money value={numericToFloat(s.monthly_amount)} currency={s.currency} class="text-[18px] tracking-[-0.03em]" />
                          <span class="font-mono text-[12px] text-muted">/mo</span>
                        </div>
                        <Show when={next}>
                          <div class="text-right">
                            <div class="font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted">Next debit</div>
                            <div class="font-mono tabular text-[12.5px] text-text mt-0.5">{shortDate(next!)}</div>
                          </div>
                        </Show>
                      </div>
                    </A>
                  );
                }}
              </For>
            </section>
          </Show>
        </div>
      </div>

      <Sheet open={sheetOpen()} onClose={() => setSheetOpen(false)} title="Add holding">
        <InvestmentForm onSuccess={handleSuccess} onClose={() => setSheetOpen(false)} />
      </Sheet>

      <Sheet open={editSheetOpen()} onClose={closeEdit} title="Edit holding">
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
