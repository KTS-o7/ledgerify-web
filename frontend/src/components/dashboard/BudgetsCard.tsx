import { For, Show, type Component } from "solid-js";
import { A } from "@solidjs/router";
import { BentoBlock } from "../ui/bento-block";
import { Eyebrow } from "../ui/eyebrow";
import { Money } from "../ui/money";
import { ProgressBar } from "../ui/progress-bar";
import { cn } from "../../lib/utils";
import type { BudgetStatus } from "./data";

/** 01 · Budgets: top four by use, 5px bars that turn warn at 90%. */
export const BudgetsCard: Component<{ budgets: BudgetStatus[]; daysLeft: number | null }> = (props) => {
  const top = () => [...props.budgets].sort((a, b) => b.spent_pct - a.spent_pct).slice(0, 4);
  const left = () => props.budgets.reduce((s, b) => s + Math.max(0, b.remaining ?? b.amount - b.spent), 0);
  return (
    <BentoBlock class="flex flex-col gap-3.5 py-[18px] px-[22px]">
      <div class="flex items-center justify-between gap-2">
        <Eyebrow as="h2">Budgets</Eyebrow>
        <Show when={props.budgets.length > 0}>
          <span class="font-mono tabular text-[12px] text-muted">
            <Money value={left()} tone="muted" /> left<Show when={props.daysLeft !== null}> · {props.daysLeft} days</Show>
          </span>
        </Show>
      </div>
      <Show when={props.budgets.length > 0} fallback={<p class="text-[13.5px] text-muted">No budgets yet. <A href="/budgets">Set one up</A>.</p>}>
        <For each={top()}>
          {(b) => (
            <A href="/budgets" class="flex flex-col gap-[7px] !text-text rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal">
              <div class="flex justify-between gap-3 text-[13px] font-medium">
                <span class="truncate">{b.name}</span>
                <span class={cn("font-mono tabular text-[12px] font-normal shrink-0", b.spent_pct > 100 ? "text-neg" : b.spent_pct >= 90 ? "text-warn" : "text-muted")}>
                  <Money value={b.spent} currency={b.currency} tone={b.spent_pct > 100 ? "neg" : b.spent_pct >= 90 ? "text" : "muted"} class={b.spent_pct >= 90 && b.spent_pct <= 100 ? "!text-warn" : undefined} /> / <Money value={b.amount} currency={b.currency} tone="muted" />
                </span>
              </div>
              <ProgressBar pct={b.spent_pct} label={`${b.name}: ${b.spent_pct}% used`} />
            </A>
          )}
        </For>
      </Show>
    </BentoBlock>
  );
};
