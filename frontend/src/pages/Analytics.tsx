import { createMemo, createSignal, createResource, For, Show } from "solid-js";
import { ShoppingCart, Coffee, Bus, Film, Utensils, ShoppingBag, Home, Zap, Heart, MoreHorizontal } from "lucide-solid";
import { api } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { DonutChart, type DonutSegment } from "../components/ui/donut-chart";
import { SegmentedControl } from "../components/ui/segmented-control";
import { CategoryBar } from "../components/ui/category-bar";
import { EmptyState } from "../components/ui/empty-state";
import { SkeletonBlock } from "../components/ui/skeleton";
import { cn } from "../lib/utils";

type Mode = "expense" | "income";

interface SummaryData {
  total_income: number;
  total_expenses: number;
  category_spending: Array<{ category_id: string; category_name: string; color: string; total: number }>;
}

function categoryIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes("groceries") || n.includes("supermarket")) return ShoppingCart;
  if (n.includes("dining") || n.includes("restaurant") || n.includes("food")) return Utensils;
  if (n.includes("coffee") || n.includes("cafe")) return Coffee;
  if (n.includes("transport") || n.includes("fuel") || n.includes("travel")) return Bus;
  if (n.includes("entertainment") || n.includes("movie") || n.includes("film")) return Film;
  if (n.includes("shopping") || n.includes("clothing")) return ShoppingBag;
  if (n.includes("rent") || n.includes("home") || n.includes("housing")) return Home;
  if (n.includes("electricity") || n.includes("utility") || n.includes("bill")) return Zap;
  if (n.includes("health") || n.includes("medical") || n.includes("doctor")) return Heart;
  return MoreHorizontal;
}

export default function Analytics() {
  const [mode, setMode] = createSignal<Mode>("expense");
  const [highlight, setHighlight] = createSignal<number | null>(null);

  const [summary] = createResource(() => api.get<SummaryData>("/v1/summary"));

  const segments = createMemo((): Array<DonutSegment & { icon: ReturnType<typeof categoryIcon> }> => {
    const data = summary();
    if (!data) return [];
    const rows = data.category_spending ?? [];
    return rows.map((r) => ({
      label: r.category_name,
      value: r.total,
      color: r.color || undefined,
      icon: categoryIcon(r.category_name),
    }));
  });

  const total = createMemo(() => segments().reduce((s, x) => s + x.value, 0));

  return (
    <>
      <PageHeader title="Analytics" />
      <div class="p-4 md:p-6 space-y-3">
        <SegmentedControl<Mode>
          options={[{ value: "expense", label: "Expense" }, { value: "income", label: "Income" }]}
          value={mode()}
          onChange={setMode}
          ariaLabel="Analytics mode"
        />
        <Show when={summary.loading}>
          <div class="grid grid-cols-1 md:grid-cols-12 gap-3">
            <SkeletonBlock class="col-span-1 md:col-span-5 min-h-[360px]" />
            <SkeletonBlock class="col-span-1 md:col-span-7 min-h-[360px]" />
          </div>
        </Show>
        <Show when={summary.error}>
          <p class="text-accent text-sm py-6 text-center">Failed to load analytics data.</p>
        </Show>
        <Show when={!summary.loading && summary()}>
          <div class="grid grid-cols-1 md:grid-cols-12 gap-3">
            <BentoBlock size="lg" class="col-span-1 md:col-span-5 flex flex-col items-center justify-center min-h-[360px]">
              <Show
                when={segments().length > 0}
                fallback={<EmptyState icon={MoreHorizontal} title="No spending data" body="Add transactions to see category breakdown." />}
              >
                <DonutChart
                  segments={segments()}
                  centerLabel={mode() === "expense" ? "Total Spent" : "Total Income"}
                  centerValue={formatCurrency(mode() === "expense" ? (summary()?.total_expenses ?? 0) : (summary()?.total_income ?? 0))}
                  centerTrend={undefined}
                  highlightIndex={highlight()}
                  onSegmentHover={setHighlight}
                  size={300}
                  thickness={36}
                />
              </Show>
            </BentoBlock>
            <BentoBlock size="md" class="col-span-1 md:col-span-7">
              <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-3 block">By Category</span>
              <Show
                when={segments().length > 0}
                fallback={<p class="text-sm text-muted py-4 text-center">No categories yet.</p>}
              >
                <ul class="flex flex-col gap-3">
                  <For each={segments()}>
                    {(seg, i) => {
                      const Icon = seg.icon;
                      const pct = () => total() > 0 ? (seg.value / total()) * 100 : 0;
                      const isActive = () => highlight() === null || highlight() === i();
                      return (
                        <li
                          onMouseEnter={() => setHighlight(i())}
                          onMouseLeave={() => setHighlight(null)}
                          class={cn(
                            "flex items-center gap-3 transition-opacity motion-reduce:transition-none",
                            !isActive() && "opacity-30"
                          )}
                        >
                          <div class="w-9 h-9 rounded-lg bg-bg flex items-center justify-center text-muted flex-shrink-0">
                            <Icon size={18} />
                          </div>
                          <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between mb-1.5">
                              <span class="font-body text-sm text-text">{seg.label}</span>
                              <span class="font-display text-sm font-semibold text-text">{formatCurrency(seg.value)}</span>
                            </div>
                            <div class="flex items-center gap-2">
                              <CategoryBar
                                value={pct() / 100}
                                color={isActive() ? "var(--color-primary)" : "var(--color-muted)"}
                                trackColor="bg-bg"
                                class="flex-1"
                              />
                              <span class="text-[12px] font-mono text-muted w-10 text-right">{pct().toFixed(0)}%</span>
                            </div>
                          </div>
                        </li>
                      );
                    }}
                  </For>
                </ul>
              </Show>
            </BentoBlock>
          </div>
        </Show>
      </div>
    </>
  );
}
