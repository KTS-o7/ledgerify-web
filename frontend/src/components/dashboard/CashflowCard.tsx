import { For, type Component } from "solid-js";
import { BentoBlock } from "../ui/bento-block";
import { Eyebrow } from "../ui/eyebrow";
import { Money } from "../ui/money";
import { formatCurrency } from "../../lib/format";
import { monthShort } from "./data";

type Props = {
  monthLabel: string;
  income: number;
  expense: number;
  months: Array<{ month: string; income: number; expense: number }>;
};

/** 01 · Cashflow: In / Out / Saved %, then six month pair-bars (past months at 45%). */
export const CashflowCard: Component<Props> = (props) => {
  const saved = () => (props.income > 0 ? Math.round(((props.income - props.expense) / props.income) * 100) : null);
  const max = () => Math.max(1, ...props.months.flatMap((m) => [m.income, m.expense]));
  const h = (v: number) => `${Math.max(v > 0 ? 3 : 0, (v / max()) * 90)}px`;
  const cell = "flex flex-col gap-2 min-w-0";
  return (
    <BentoBlock class="flex flex-col gap-[18px] py-[22px] px-6">
      <Eyebrow as="h2">{props.monthLabel} cashflow</Eyebrow>
      <div class="grid grid-cols-3 gap-3">
        <div class={cell}><span class="text-[12.5px] font-medium text-muted">In</span><Money value={props.income} tone="pos" class="text-[21px] font-medium tracking-[-0.03em] truncate" /></div>
        <div class={cell}><span class="text-[12.5px] font-medium text-muted">Out</span><Money value={props.expense} class="text-[21px] font-medium tracking-[-0.03em] truncate" /></div>
        <div class={cell}>
          <span class="text-[12.5px] font-medium text-muted">Saved</span>
          <span class={`font-mono tabular text-[21px] font-medium tracking-[-0.03em] ${saved() !== null && saved()! < 0 ? "text-neg" : "text-signal"}`}>
            {saved() === null ? "—" : `${saved()}%`}
          </span>
        </div>
      </div>
      <div class="flex items-end gap-3.5 h-[118px] pt-1.5 border-t border-border" role="img"
        aria-label={`Income and spending, last ${props.months.length} months: ${props.months.map((m) => `${monthShort(m.month)} in ${formatCurrency(m.income)}, out ${formatCurrency(m.expense)}`).join("; ")}`}>
        <For each={props.months}>
          {(m, i) => {
            const op = () => (i() === props.months.length - 1 ? 1 : 0.45);
            return (
              <div class="flex-1 flex flex-col items-center gap-[7px]" aria-hidden="true">
                <div class="flex items-end gap-[3px] h-[90px]">
                  <div class="w-3 rounded-t-[3px] rounded-b-[1px] bg-pos transition-[height] duration-[800ms] ease-[var(--ease-standard)] motion-reduce:transition-none" style={{ height: h(m.income), opacity: op() }} />
                  <div class="w-3 rounded-t-[3px] rounded-b-[1px] bg-neg transition-[height] duration-[800ms] ease-[var(--ease-standard)] motion-reduce:transition-none" style={{ height: h(m.expense), opacity: op() }} />
                </div>
                <span class="font-mono text-[11px] text-muted">{monthShort(m.month)}</span>
              </div>
            );
          }}
        </For>
      </div>
    </BentoBlock>
  );
};
