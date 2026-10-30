import { createMemo, For, Show, type Component } from "solid-js";
import { Pencil, Trash2 } from "lucide-solid";
import { numericToFloat, pgTextToString, formatCurrency, getCurrency } from "../../lib/format";
import { cn } from "../../lib/utils";
import { CATEGORY_PALETTE } from "../ui/donut-chart";
import { Money } from "../ui/money";
import { ProgressBar } from "../ui/progress-bar";
import { daysLeftInMonth, paceSummary } from "./budget-math";

/** Budget as returned by GET /v1/budgets. */
export interface Budget {
  id: string;
  name: string;
  amount: unknown;        // pgtype.Numeric
  currency: string;
  period_type: string;
  category_name: unknown; // pgtype.Text
  category_id: string | null;
  spent: number;
  remaining: number;
  spent_pct: number;
  rollover: boolean;
  start_date: unknown;    // pgtype.Date
  end_date: unknown;      // pgtype.Date
}

const pctLabel = (pct: number) => `${Math.round(pct)}%`;

/** Remaining amount, days left, pace bar and a pace sentence (default currency only). */
export const BudgetSummary: Component<{ budgets: Budget[] }> = (props) => {
  const currency = getCurrency();
  const inCurrency = createMemo(() => props.budgets.filter((b) => b.currency === currency));
  const others = () => props.budgets.length - inCurrency().length;
  const s = createMemo(() =>
    paceSummary(inCurrency().map((b) => ({ amount: numericToFloat(b.amount), spent: b.spent, period_type: b.period_type, currency: b.currency }))),
  );
  const over = () => s().delta > 0;
  const days = daysLeftInMonth();

  return (
    <div class="flex flex-col gap-3 p-[18px] rounded-card bg-surface border border-border">
      <div class="flex items-baseline justify-between gap-3">
        <Money value={Math.abs(s().remaining)} currency={currency} tone={s().remaining < 0 ? "neg" : "text"} class="text-[30px] tracking-[-0.04em] leading-none" />
        <span class="font-mono tabular text-[12.5px] text-muted">{days} day{days === 1 ? "" : "s"} left</span>
      </div>
      <p class="text-[13.5px] text-muted">
        {s().remaining < 0 ? "over" : "remaining of"} <span class="font-mono tabular">{formatCurrency(s().limit, currency)}</span> across{" "}
        <span class="font-mono tabular">{s().count}</span> budget{s().count === 1 ? "" : "s"}
        <Show when={others() > 0}> · <span class="font-mono tabular">{others()}</span> in other currencies</Show>
      </p>
      {/* Spent so far vs where the calendar says you should be. */}
      <div class="relative mt-1" role="img" aria-label={`${pctLabel(s().spentPct)} spent, ${pctLabel(s().elapsedPct)} of the period elapsed`}>
        <div class="h-2 w-full rounded-pill bg-sunken overflow-hidden">
          <div
            class={cn("h-full rounded-pill transition-[width] duration-[800ms] ease-[var(--ease-standard)] motion-reduce:transition-none", s().spentPct > 100 ? "bg-neg" : over() ? "bg-warn" : "bg-signal")}
            style={{ width: `${Math.min(100, s().spentPct)}%` }}
          />
        </div>
        <span class="absolute -top-1 w-px h-4 bg-text/60" style={{ left: `${Math.min(100, s().elapsedPct)}%` }} aria-hidden="true" />
      </div>
      <p class="text-[12.5px] leading-[1.4] text-muted">
        <Show when={s().count > 0} fallback="Add a budget to track your pace.">
          <span class={over() ? "text-warn" : "text-text"}>{over() ? "Over pace" : "On pace"}:</span>{" "}
          <span class="font-mono tabular">{formatCurrency(Math.abs(s().delta), currency)}</span> {over() ? "more than" : "less than"} an even spend by today.
        </Show>
      </p>
    </div>
  );
};

type ListProps = {
  budgets: Budget[];
  onEdit?: (b: Budget) => void;
  onDelete?: (b: Budget) => void;
};

/** Budget rows: colour square, name, "left" on the right, 5px bar, "spent of limit · %" in mono. */
export const BudgetList: Component<ListProps> = (props) => (
  <ul class="flex flex-col rounded-card bg-surface border border-border overflow-hidden">
    <For each={props.budgets}>
      {(b, i) => {
        const amount = () => numericToFloat(b.amount);
        const pct = () => (amount() > 0 ? (b.spent / amount()) * 100 : 0);
        const left = () => amount() - b.spent;
        const cat = () => pgTextToString(b.category_name);
        return (
          <li class="group flex flex-col gap-[9px] px-4 py-3.5 border-b border-border last:border-b-0">
            <div class="flex items-center gap-2.5">
              <span class="w-2 h-2 rounded-[2px] shrink-0" style={{ background: CATEGORY_PALETTE[i() % CATEGORY_PALETTE.length] }} aria-hidden="true" />
              <span class="flex-1 min-w-0 truncate text-[15px] font-medium text-text">
                {b.name}
                <Show when={cat() && cat() !== b.name}>
                  <span class="text-muted font-normal text-[13px]"> · {cat()}</span>
                </Show>
              </span>
              <span class={cn("font-mono tabular text-[13px]", left() < 0 ? "text-neg" : pct() >= 90 ? "text-warn" : "text-text")}>
                {left() < 0 ? `${formatCurrency(-left(), b.currency)} over` : `${formatCurrency(left(), b.currency)} left`}
              </span>
              <Show when={props.onEdit || props.onDelete}>
                <div class="flex items-center gap-0.5 -mr-1.5 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity duration-[160ms]">
                  <Show when={props.onEdit}>
                    <button type="button" onClick={() => props.onEdit!(b)} aria-label={`Edit ${b.name}`}
                      class="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-raised transition-colors duration-[160ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal">
                      <Pencil size={14} />
                    </button>
                  </Show>
                  <Show when={props.onDelete}>
                    <button type="button" onClick={() => props.onDelete!(b)} aria-label={`Delete ${b.name}`}
                      class="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-neg hover:bg-raised transition-colors duration-[160ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal">
                      <Trash2 size={14} />
                    </button>
                  </Show>
                </div>
              </Show>
            </div>
            <ProgressBar pct={pct()} label={`${b.name}: ${pctLabel(pct())} of budget used`} />
            <span class="font-mono tabular text-[11.5px] text-muted">
              {formatCurrency(b.spent, b.currency)} of {formatCurrency(amount(), b.currency)} · {pctLabel(pct())}
              <Show when={b.period_type === "weekly"}> · weekly</Show>
            </span>
          </li>
        );
      }}
    </For>
  </ul>
);
