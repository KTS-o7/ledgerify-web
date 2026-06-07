import { createResource, Show } from "solid-js";
import { BarChart3 } from "lucide-solid";
import { api } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { Stat } from "../components/ui/stat";
import { Sparkline } from "../components/ui/sparkline";
import { SkeletonBlock } from "../components/ui/skeleton";

interface NetWorthData { total_assets: number; total_liabilities: number; networth: number; }
interface SummaryData { monthly_networth: Array<{ date: string; total_balance: number }>; }

export default function ReportsNetworth() {
  const [data] = createResource(() => api.get<NetWorthData>("/v1/networth"));
  const [summary] = createResource(() => api.get<SummaryData>("/v1/summary"));

  return (
    <>
      <PageHeader title="Net Worth Report" back />
      <div class="p-4 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-3">
        <Show when={data.loading}>
          <SkeletonBlock class="col-span-1 md:col-span-12 min-h-[200px]" />
        </Show>
        <Show when={data.error}>
          <p class="text-accent text-sm py-6 text-center col-span-1 md:col-span-12">Failed to load net worth data.</p>
        </Show>
        <Show when={data()}>
          {(d) => (
            <>
              <BentoBlock size="lg" class="col-span-1 md:col-span-4">
                <Stat label="Net Worth" value={formatCurrency(d().networth)} size="xl" tone={d().networth >= 0 ? "primary" : "accent"} />
              </BentoBlock>
              <BentoBlock size="md" class="col-span-1 md:col-span-8">
                <div class="flex items-center justify-between mb-3">
                  <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide">6-month trend</span>
                  <BarChart3 size={16} class="text-muted" />
                </div>
                <Show
                  when={!summary.loading && (summary()?.monthly_networth ?? []).length > 1}
                  fallback={<p class="text-muted text-sm py-4 text-center">Not enough data for a trend yet.</p>}
                >
                  <Sparkline
                    values={(summary()?.monthly_networth ?? []).map((r) => r.total_balance)}
                    width={undefined}
                    height={120}
                    tone={d().networth >= 0 ? "primary" : "accent"}
                    class="w-full"
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
