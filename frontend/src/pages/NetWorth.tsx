import { createResource, Show } from "solid-js";
import { BarChart3, TrendingUp, TrendingDown, Minus } from "lucide-solid";
import { api } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { Stat } from "../components/ui/stat";
import { Sparkline } from "../components/ui/sparkline";
import { SkeletonBlock } from "../components/ui/skeleton";

interface NetWorthData { total_assets: number; total_liabilities: number; networth: number; }
interface SummaryData { monthly_networth: Array<{ date: string; total_balance: number }>; }

export default function NetWorth() {
  const [data] = createResource(() => api.get<NetWorthData>("/v1/networth"));
  const [summary] = createResource(() => api.get<SummaryData>("/v1/summary"));

  return (
    <>
      <PageHeader title="Net Worth" />
      <div class="p-4 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4">

        <Show when={data.loading}>
          <SkeletonBlock class="col-span-1 md:col-span-5 min-h-[200px]" />
          <SkeletonBlock class="col-span-1 md:col-span-7 min-h-[200px]" />
        </Show>

        <Show when={data.error && !data()}>
          <BentoBlock class="col-span-1 md:col-span-12 flex items-center justify-center py-16">
            <p class="text-accent text-sm">Couldn't load net worth. Try again later.</p>
          </BentoBlock>
        </Show>

        <Show when={data()}>
          {(d) => {
            const isPositive = () => d().networth >= 0;
            const sparkValues = () => (summary()?.monthly_networth ?? []).map((r) => r.total_balance);
            const hasSpark = () => sparkValues().length > 1;

            return (
              <>
                {/* Left: headline figure + asset/liability breakdown */}
                <BentoBlock class="col-span-1 md:col-span-5 flex flex-col justify-between gap-6">
                  <Stat
                    label="Net Worth"
                    value={formatCurrency(d().networth)}
                    size="xl"
                    tone={isPositive() ? "primary" : "accent"}
                  />
                  <div class="flex flex-col gap-4 pt-2 border-t border-border">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <TrendingUp size={14} class="text-primary" />
                        <span class="text-[13px] text-muted font-medium uppercase tracking-wide">Assets</span>
                      </div>
                      <span class="font-display font-semibold text-lg text-primary">{formatCurrency(d().total_assets)}</span>
                    </div>
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <TrendingDown size={14} class="text-accent" />
                        <span class="text-[13px] text-muted font-medium uppercase tracking-wide">Liabilities</span>
                      </div>
                      <span class="font-display font-semibold text-lg text-accent">{formatCurrency(d().total_liabilities)}</span>
                    </div>
                    <div class="flex items-center justify-between pt-2 border-t border-border">
                      <div class="flex items-center gap-2">
                        <Minus size={14} class={isPositive() ? "text-primary" : "text-accent"} />
                        <span class="text-[13px] text-muted font-medium uppercase tracking-wide">Net</span>
                      </div>
                      <span class={`font-display font-bold text-xl ${isPositive() ? "text-primary" : "text-accent"}`}>{formatCurrency(d().networth)}</span>
                    </div>
                  </div>
                </BentoBlock>

                {/* Right: sparkline trend */}
                <BentoBlock class="col-span-1 md:col-span-7 flex flex-col min-h-[200px]">
                  <div class="flex items-center justify-between mb-4">
                    <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide">6-month trend</span>
                    <BarChart3 size={16} class="text-muted" />
                  </div>
                  <Show
                    when={!summary.loading && hasSpark()}
                    fallback={
                      <div class="flex-1 flex items-center justify-center">
                        <p class="text-muted text-sm">Not enough data for a trend yet.</p>
                      </div>
                    }
                  >
                    <div class="flex-1 flex items-end">
                      <Sparkline
                        values={sparkValues()}
                        height={160}
                        tone={isPositive() ? "primary" : "accent"}
                        class="w-full"
                      />
                    </div>
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
