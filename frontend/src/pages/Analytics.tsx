import { createMemo, createSignal, For } from "solid-js";
import { ShoppingCart, Coffee, Bus, Film, MoreHorizontal } from "lucide-solid";
import { formatCurrency } from "../lib/format";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { DonutChart, type DonutSegment } from "../components/ui/donut-chart";
import { SegmentedControl } from "../components/ui/segmented-control";
import { CategoryBar } from "../components/ui/category-bar";
import { cn } from "../lib/utils";

type Mode = "expense" | "income";

const SAMPLE_SEGMENTS: Array<DonutSegment & { icon: typeof ShoppingCart }> = [
  { label: "Groceries", value: 4200, icon: ShoppingCart },
  { label: "Dining", value: 2800, icon: Coffee },
  { label: "Transport", value: 1900, icon: Bus },
  { label: "Entertainment", value: 1100, icon: Film },
  { label: "Other", value: 800, icon: MoreHorizontal },
];

export default function Analytics() {
  const [mode, setMode] = createSignal<Mode>("expense");
  const [highlight, setHighlight] = createSignal<number | null>(null);

  const total = createMemo(() => SAMPLE_SEGMENTS.reduce((s, x) => s + x.value, 0));

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
        <div class="grid grid-cols-1 md:grid-cols-12 gap-3">
          <BentoBlock size="lg" class="col-span-1 md:col-span-5 flex flex-col items-center justify-center min-h-[360px]">
            <DonutChart
              segments={SAMPLE_SEGMENTS}
              centerLabel={mode() === "expense" ? "Total Spent" : "Total Income"}
              centerValue={formatCurrency(total())}
              centerTrend={{ dir: "up", value: "+12%" }}
              highlightIndex={highlight()}
              onSegmentHover={setHighlight}
              size={300}
              thickness={36}
            />
          </BentoBlock>
          <BentoBlock size="md" class="col-span-1 md:col-span-7">
            <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-3 block">By Category</span>
            <ul class="flex flex-col gap-3">
              <For each={SAMPLE_SEGMENTS}>
                {(seg, i) => {
                  const Icon = seg.icon;
                  const pct = () => (seg.value / total()) * 100;
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
          </BentoBlock>
        </div>
      </div>
    </>
  );
}
