import { For, type Component } from "solid-js";
import { formatCurrency } from "../../lib/format";

export type PairBarMonth = { label: string; income: number; expense: number };

/**
 * Monthly income/expense pairs: income in pos, expense in neg.
 * Past months sit at 45% opacity so the latest month reads first.
 */
export const PairBars: Component<{ months: PairBarMonth[]; height?: number }> = (props) => {
  const h = () => props.height ?? 140;
  const max = () => Math.max(1, ...props.months.flatMap((m) => [m.income, m.expense]));
  const bar = (v: number) => `${Math.max(v > 0 ? 2 : 0, (v / max()) * 100)}%`;
  return (
    <div>
      <div class="flex items-end gap-3" style={{ height: `${h()}px` }} role="list" aria-label="Income and expenses by month">
        <For each={props.months}>
          {(m, i) => (
            <div
              role="listitem"
              aria-label={`${m.label}: in ${formatCurrency(m.income)}, out ${formatCurrency(m.expense)}`}
              class="flex-1 h-full flex items-end justify-center gap-1"
              style={{ opacity: i() === props.months.length - 1 ? 1 : 0.45 }}
            >
              <div class="w-full max-w-[18px] rounded-t-[4px] bg-pos transition-[height] duration-[800ms] ease-[var(--ease-standard)] motion-reduce:transition-none" style={{ height: bar(m.income) }} />
              <div class="w-full max-w-[18px] rounded-t-[4px] bg-neg transition-[height] duration-[800ms] ease-[var(--ease-standard)] motion-reduce:transition-none" style={{ height: bar(m.expense) }} />
            </div>
          )}
        </For>
      </div>
      <div class="flex gap-3 mt-2" aria-hidden="true">
        <For each={props.months}>
          {(m) => <span class="flex-1 text-center font-mono tabular text-[10.5px] text-faint">{m.label}</span>}
        </For>
      </div>
    </div>
  );
};
