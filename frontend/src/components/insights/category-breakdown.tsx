import { createMemo, createSignal, For, type Component } from "solid-js";
import { DonutChart, CATEGORY_PALETTE } from "../ui/donut-chart";
import { Money } from "../ui/money";
import { formatCurrency } from "../../lib/format";
import { cn } from "../../lib/utils";

export type CategoryTotal = { category_id: string; category_name: string; color?: string; total: number };

type Props = {
  rows: CategoryTotal[];
  /** Eyebrow in the donut centre, e.g. "Spent". */
  centerLabel: string;
  /** Delta vs the previous month, already formatted, e.g. "−8% vs Sep". */
  trend?: { dir: "up" | "down"; value: string; tone: "pos" | "neg" };
  size?: number;
};

/** 232px donut (r 96, stroke 20, 3px gaps) plus colour-square / name / % / amount rows. */
export const CategoryBreakdown: Component<Props> = (props) => {
  const [highlight, setHighlight] = createSignal<number | null>(null);

  // Sort once so the donut (which also sorts by value) and the rows share colours.
  const rows = createMemo(() =>
    [...props.rows]
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total)
      .map((r, i) => ({ ...r, swatch: r.color || CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]! })),
  );
  const total = createMemo(() => rows().reduce((s, r) => s + r.total, 0));

  return (
    <div class="flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
      <div class="flex justify-center md:shrink-0">
        <DonutChart
          segments={rows().map((r) => ({ label: r.category_name, value: r.total, color: r.swatch }))}
          centerLabel={props.centerLabel}
          centerValue={formatCurrency(total())}
          centerTrend={props.trend}
          highlightIndex={highlight()}
          onSegmentHover={setHighlight}
          size={props.size ?? 232}
          thickness={20}
        />
      </div>
      <ul class="flex flex-col gap-3.5 flex-1 min-w-0" aria-label="Categories">
        <For each={rows()}>
          {(r, i) => {
            const pct = () => (total() > 0 ? (r.total / total()) * 100 : 0);
            return (
              <li
                onMouseEnter={() => setHighlight(i())}
                onMouseLeave={() => setHighlight(null)}
                class={cn(
                  "flex items-center gap-3 transition-opacity duration-[160ms] motion-reduce:transition-none",
                  highlight() !== null && highlight() !== i() && "opacity-40",
                )}
              >
                <span class="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: r.swatch }} aria-hidden="true" />
                <span class="flex-1 min-w-0 truncate text-[14.5px] font-medium text-text">{r.category_name}</span>
                <span class="w-10 text-right font-mono tabular text-[12px] text-muted">{pct().toFixed(0)}%</span>
                <Money value={r.total} class="inline-block w-[96px] shrink-0 text-right text-[14px]" />
              </li>
            );
          }}
        </For>
      </ul>
    </div>
  );
};
