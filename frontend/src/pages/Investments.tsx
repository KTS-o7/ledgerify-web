import { createResource, createSignal, For, Show } from "solid-js";
import { Plus, TrendingUp, Calendar, Pencil, Trash2 } from "lucide-solid";
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

export default function Investments() {
  const [holdings, { refetch }] = createResource(() => api.get<Holding[]>("/v1/investments"));
  const [sheetOpen, setSheetOpen] = createSignal(false);
  const [editHolding, setEditHolding] = createSignal<Holding | null>(null);
  const [editSheetOpen, setEditSheetOpen] = createSignal(false);

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
