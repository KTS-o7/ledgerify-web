import { createResource, createSignal, For, Show } from "solid-js";
import { api } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { onDataChanged } from "../lib/events";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { Stat } from "../components/ui/stat";
import { Eyebrow } from "../components/ui/eyebrow";
import { Money } from "../components/ui/money";
import { SkeletonBlock } from "../components/ui/skeleton";
import { MonthPicker, currentMonth } from "../components/ui/month-picker";
import { PairBars } from "../components/insights/pair-bars";

interface SummaryData {
  total_income: number;
  total_expenses: number;
  monthly_networth: Array<{ date: string; total_balance: number; income: number; expense: number }> | null;
}

function formatMonth(yyyyMM: string): string {
  const [year, month] = yyyyMM.split("-");
  return new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleString("en-US", { month: "short" });
}

export default function ReportsCashflow() {
  const [month, setMonth] = createSignal(currentMonth());
  const [summary, { refetch }] = createResource(month, (m) => api.get<SummaryData>(`/v1/summary?month=${m}`));
  onDataChanged(() => refetch());

  return (
    <>
      <PageHeader title="Cash flow" back actions={<MonthPicker value={month()} onChange={setMonth} />} />
      <div class="px-5 md:px-7 py-5 md:py-6 grid grid-cols-1 md:grid-cols-12 gap-4">
        <Show when={summary.loading}>
          <SkeletonBlock class="md:col-span-7 min-h-[140px]" />
          <SkeletonBlock class="md:col-span-5 min-h-[140px]" />
          <SkeletonBlock class="md:col-span-12 min-h-[240px]" />
        </Show>
        <Show when={summary.error}>
          <p class="text-neg text-sm py-6 text-center md:col-span-12">Failed to load cash flow data.</p>
        </Show>
        <Show when={!summary.loading && summary()}>
          {(s) => {
            const net = () => s().total_income - s().total_expenses;
            const saved = () => (s().total_income > 0 ? Math.round((net() / s().total_income) * 100) : null);
            const monthly = () => s().monthly_networth ?? [];
            return (
              <>
                <BentoBlock class="md:col-span-7">
                  <div class="grid grid-cols-3 gap-4">
                    <Stat label="In" value={formatCurrency(s().total_income)} tone="pos" />
                    <Stat label="Out" value={formatCurrency(s().total_expenses)} />
                    <Stat label="Saved" value={saved() === null ? "—" : `${saved()}%`} tone={saved() !== null && saved()! < 0 ? "neg" : "default"} />
                  </div>
                </BentoBlock>
                <BentoBlock class="md:col-span-5">
                  <Stat
                    label="Net cash flow"
                    value={`${net() >= 0 ? "+" : "−"}${formatCurrency(Math.abs(net()))}`}
                    tone={net() >= 0 ? "pos" : "neg"}
                    size="lg"
                  />
                </BentoBlock>

                <BentoBlock class="md:col-span-12">
                  <div class="flex items-center justify-between mb-5">
                    <Eyebrow as="h2">Six months</Eyebrow>
                    <div class="flex items-center gap-4 text-[12px] text-muted" aria-hidden="true">
                      <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-[2px] bg-pos" />In</span>
                      <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-[2px] bg-neg" />Out</span>
                    </div>
                  </div>
                  <Show when={monthly().length > 0} fallback={<p class="text-muted text-sm py-8 text-center">No transactions in the last six months.</p>}>
                    <PairBars months={monthly().map((r) => ({ label: formatMonth(r.date), income: r.income ?? 0, expense: r.expense ?? 0 }))} />
                    <table class="w-full mt-6 text-[13.5px]">
                      <caption class="sr-only">Income, expenses and net by month</caption>
                      <thead>
                        <tr class="text-left">
                          <th scope="col" class="font-mono font-medium text-[11px] uppercase tracking-[0.1em] text-muted pb-2">Month</th>
                          <th scope="col" class="font-mono font-medium text-[11px] uppercase tracking-[0.1em] text-muted pb-2 text-right">In</th>
                          <th scope="col" class="font-mono font-medium text-[11px] uppercase tracking-[0.1em] text-muted pb-2 text-right">Out</th>
                          <th scope="col" class="font-mono font-medium text-[11px] uppercase tracking-[0.1em] text-muted pb-2 text-right">Net</th>
                        </tr>
                      </thead>
                      <tbody>
                        <For each={[...monthly()].reverse()}>
                          {(r) => (
                            <tr class="border-t border-border h-11">
                              <td class="font-mono tabular text-muted">{formatMonth(r.date)} {r.date.slice(0, 4)}</td>
                              <td class="text-right"><Money value={r.income ?? 0} tone="pos" /></td>
                              <td class="text-right"><Money value={r.expense ?? 0} /></td>
                              <td class="text-right"><Money value={r.total_balance} tone={r.total_balance < 0 ? "neg" : "text"} signed /></td>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </table>
                  </Show>
                </BentoBlock>
              </>
            );
          }}
        </Show>
      </div>
    </>
  );
}
