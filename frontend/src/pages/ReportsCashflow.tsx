import { createResource, createSignal, Show } from "solid-js";
import { api } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { Stat } from "../components/ui/stat";
import { SkeletonBlock } from "../components/ui/skeleton";
import { MonthPicker } from "../components/ui/month-picker";

interface SummaryData {
  total_income: number;
  total_expenses: number;
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function ReportsCashflow() {
  const [month, setMonth] = createSignal(currentMonth());
  const [summary] = createResource(month, (m) => api.get<SummaryData>(`/v1/summary?month=${m}`));

  return (
    <>
      <PageHeader title="Cash Flow" back actions={<MonthPicker value={month()} onChange={setMonth} />} />
      <div class="p-4 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-3">
        <Show when={summary.loading}>
          <SkeletonBlock class="col-span-1 md:col-span-6 min-h-[160px]" />
          <SkeletonBlock class="col-span-1 md:col-span-6 min-h-[160px]" />
        </Show>
        <Show when={summary.error}>
          <p class="text-accent text-sm py-6 text-center col-span-1 md:col-span-12">Failed to load cash flow data.</p>
        </Show>
        <Show when={summary()}>
          {(s) => {
            const net = () => s().total_income - s().total_expenses;
            return (
                <>
                  <BentoBlock class="col-span-1 md:col-span-7 flex flex-col justify-center gap-6">
                    <div class="grid grid-cols-2 gap-6">
                      <Stat label="Income" value={formatCurrency(s().total_income)} tone="primary" size="lg" />
                      <Stat label="Expenses" value={formatCurrency(s().total_expenses)} size="lg" />
                    </div>
                  </BentoBlock>
                  <BentoBlock class="col-span-1 md:col-span-5 flex flex-col justify-center">
                    <Stat label="Net Cash Flow" value={formatCurrency(net())} tone={net() >= 0 ? "primary" : "accent"} size="xl" trend={{ dir: net() >= 0 ? "up" : "down", value: `${net() >= 0 ? "+" : ""}${formatCurrency(Math.abs(net()))}` }} />
                  </BentoBlock>
                </>
            );
          }}
        </Show>
      </div>
    </>
  );
}
