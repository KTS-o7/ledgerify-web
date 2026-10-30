import { createResource, createSignal, Show } from "solid-js";
import { api } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { Stat } from "../components/ui/stat";
import { Eyebrow } from "../components/ui/eyebrow";
import { Money } from "../components/ui/money";
import { AreaChart } from "../components/ui/area-chart";
import { SkeletonBlock } from "../components/ui/skeleton";
import { MonthPicker, currentMonth } from "../components/ui/month-picker";

interface NetWorthData { total_assets: number; total_liabilities: number; networth: number; }
interface SummaryData { monthly_networth: Array<{ date: string; total_balance: number }> | null; }

function formatMonth(yyyyMM: string): string {
  const [year, month] = yyyyMM.split("-");
  return new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleString("en-US", { month: "short" });
}

export default function ReportsNetworth() {
  const [month, setMonth] = createSignal(currentMonth());
  const [data] = createResource(() => api.get<NetWorthData>("/v1/networth"));
  const [summary] = createResource(month, (m) => api.get<SummaryData>(`/v1/summary?month=${m}`));
  const monthly = () => summary()?.monthly_networth ?? [];

  return (
    <>
      <PageHeader title="Net worth" back actions={<MonthPicker value={month()} onChange={setMonth} />} />
      <div class="px-5 md:px-7 py-5 md:py-6 grid grid-cols-1 md:grid-cols-12 gap-4">
        <Show when={data.loading}>
          <SkeletonBlock class="md:col-span-12 min-h-[200px]" />
        </Show>
        <Show when={data.error}>
          <p class="text-neg text-sm py-6 text-center md:col-span-12">Failed to load net worth data.</p>
        </Show>
        <Show when={data()}>
          {(d) => (
            <>
              <BentoBlock class="md:col-span-5 flex flex-col gap-5">
                <div class="flex flex-col gap-2">
                  <Eyebrow as="h2">Net worth</Eyebrow>
                  <Money
                    value={d().networth}
                    tone={d().networth >= 0 ? "signal" : "neg"}
                    mutedSymbol
                    class="text-[38px] md:text-[46px] tracking-[-0.04em] leading-none"
                  />
                </div>
                <div class="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                  <Stat label="Assets" value={formatCurrency(d().total_assets)} />
                  <Stat label="Liabilities" value={formatCurrency(d().total_liabilities)} tone={d().total_liabilities > 0 ? "neg" : "default"} />
                </div>
              </BentoBlock>
              <BentoBlock class="md:col-span-7 min-h-[220px]">
                <Eyebrow as="h2" class="mb-4 block">Net flow by month</Eyebrow>
                <Show
                  when={!summary.loading && monthly().length > 1}
                  fallback={<p class="text-muted text-sm py-8 text-center">Not enough data for a trend yet.</p>}
                >
                  <AreaChart
                    values={monthly().map((r) => r.total_balance)}
                    labels={monthly().map((r) => formatMonth(r.date))}
                    height={150}
                    endDot
                    ariaLabel="Monthly net cash flow, last six months"
                  />
                </Show>
              </BentoBlock>
            </>
          )}
        </Show>
      </div>
    </>
  );
}
