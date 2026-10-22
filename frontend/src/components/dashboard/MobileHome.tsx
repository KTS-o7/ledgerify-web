import { For, Show, type Component } from "solid-js";
import { A } from "@solidjs/router";
import { Dynamic } from "solid-js/web";
import { Eyebrow } from "../ui/eyebrow";
import { NumberRoll } from "../ui/number-roll";
import { Money } from "../ui/money";
import { Sparkline } from "../ui/sparkline";
import { TransactionRow } from "../ui/transaction-row";
import { cn } from "../../lib/utils";
import { accountIcon, categoryColor, categoryIcon, compactMoney, type AccountBalance, type Row } from "./data";
import type { AlertItem } from "./AlertPills";

type Props = {
  networth: number;
  change: number | null;
  spark: number[];
  income: number;
  expense: number;
  alerts: AlertItem[];
  accounts: AccountBalance[];
  rows: Row[];
  onOpen: (row: Row) => void;
};

/** 03 · Mobile Home: net worth, In/Out/Saved strip, top alert, account cards, recent list. */
export const MobileHome: Component<Props> = (props) => {
  const saved = () => (props.income > 0 ? Math.round(((props.income - props.expense) / props.income) * 100) : null);
  const strip = "flex flex-col gap-2 p-3.5 min-w-0";
  return (
    <div class="md:hidden flex flex-col gap-[18px]">
      <section class="flex flex-col gap-2 pt-1.5" aria-label="Net worth">
        <Eyebrow as="h2">Net worth</Eyebrow>
        <NumberRoll value={props.networth} mutedSymbol tone={props.networth < 0 ? "neg" : "text"} class="text-[38px] leading-none font-medium tracking-[-0.05em]" />
        <Show when={props.change !== null}>
          <span class={cn("font-mono tabular text-[13px] font-medium", props.change! < 0 ? "text-neg" : "text-pos")}>
            <Money value={props.change!} signed tone={props.change! < 0 ? "neg" : "pos"} /> this month
          </span>
        </Show>
        <Show when={props.spark.length > 1}>
          <Sparkline values={props.spark} height={64} width={350} class="w-full mt-1" tone="signal" />
        </Show>
      </section>

      <div class="grid grid-cols-3 rounded-card bg-surface border border-border">
        <div class={strip}><span class="text-[12px] font-medium text-muted">In</span><span class="font-mono tabular text-[15px] font-medium tracking-[-0.03em] text-pos truncate">{compactMoney(props.income)}</span></div>
        <div class={cn(strip, "border-l border-border")}><span class="text-[12px] font-medium text-muted">Out</span><span class="font-mono tabular text-[15px] font-medium tracking-[-0.03em] text-text truncate">{compactMoney(props.expense)}</span></div>
        <div class={cn(strip, "border-l border-border")}><span class="text-[12px] font-medium text-muted">Saved</span><span class={cn("font-mono tabular text-[15px] font-medium tracking-[-0.03em]", saved() !== null && saved()! < 0 ? "text-neg" : "text-signal")}>{saved() === null ? "—" : `${saved()}%`}</span></div>
      </div>

      <Show when={props.alerts[0]}>
        {(a) => (
          <div class="flex items-center gap-3 px-3.5 py-3 rounded-[14px] bg-surface border border-border" role="status">
            <span class={cn("w-2 h-2 rounded-full shrink-0", a().level === "warn" ? "bg-warn" : "bg-signal")} aria-hidden="true" />
            <span class="flex-1 text-[14px] font-medium leading-[1.3] text-text">{a().text}<Show when={a().meta}> · {a().meta}</Show></span>
            <Show when={props.alerts.length > 1}>
              <span class="font-mono tabular text-[12px] font-medium text-muted" aria-label={`${props.alerts.length - 1} more alerts`}>+{props.alerts.length - 1}</span>
            </Show>
          </div>
        )}
      </Show>

      <section class="flex flex-col gap-2.5" aria-label="Accounts">
        <div class="flex justify-between items-center">
          <Eyebrow as="h2">Accounts</Eyebrow>
          <A href="/accounts" class="text-[13px] font-medium">All {props.accounts.length}</A>
        </div>
        <Show when={props.accounts.length > 0} fallback={<p class="text-[13.5px] text-muted">No accounts yet. <A href="/accounts">Add one</A>.</p>}>
          <ul class="flex gap-2.5 overflow-x-auto scrollbar-none -mr-5 pr-5 snap-x">
            <For each={props.accounts}>
              {(a) => (
                <li class="shrink-0 basis-[136px] snap-start">
                  <A href="/accounts" class="flex flex-col gap-3.5 p-3.5 rounded-[16px] bg-surface border border-border !text-text active:scale-[0.97] transition-transform duration-[90ms] motion-reduce:active:scale-100">
                    <span class="flex justify-between items-center">
                      <Dynamic component={accountIcon(a.type)} size={16} class="text-muted" />
                      <span class="font-mono font-medium text-[10.5px] text-muted">{a.currency}</span>
                    </span>
                    <span class="flex flex-col gap-1.5 min-w-0">
                      <span class="text-[13px] font-medium text-muted truncate">{a.name}</span>
                      <span class={cn("font-mono tabular text-[15px] font-medium tracking-[-0.03em] truncate", a.balance < 0 ? "text-neg" : "text-text")}>{a.balance < 0 ? "−" : ""}{compactMoney(Math.abs(a.balance), a.currency)}</span>
                    </span>
                  </A>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </section>

      <section class="flex flex-col" aria-label="Recent">
        <div class="flex justify-between items-center pb-1">
          <Eyebrow as="h2">Recent</Eyebrow>
          <A href="/activity" class="text-[13px] font-medium">View all</A>
        </div>
        <Show when={props.rows.length > 0} fallback={<p class="text-[13.5px] text-muted py-6">No transactions this month yet.</p>}>
          <div class="flex flex-col divide-y divide-border">
            <For each={props.rows}>
              {(r) => (
                <TransactionRow
                  icon={categoryIcon(r.category)}
                  color={categoryColor(r.categoryKey)}
                  merchant={r.title}
                  category={r.category}
                  amount={r.amount}
                  currency={r.currency}
                  type={r.type}
                  date={r.date}
                  recurring={r.recurring}
                  onClick={() => props.onOpen(r)}
                />
              )}
            </For>
          </div>
        </Show>
      </section>
    </div>
  );
};
