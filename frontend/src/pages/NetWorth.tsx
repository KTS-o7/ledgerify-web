import { createResource, For, Show } from "solid-js";
import { Plus, TrendingUp, TrendingDown, BarChart3 } from "lucide-solid";
import { api } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { Stat } from "../components/ui/stat";
import { Sparkline } from "../components/ui/sparkline";
import { SkeletonBlock } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";

interface NetWorthData { current: number; history: number[]; topMovers: Array<{ name: string; delta: number }>; }

const SAMPLE: NetWorthData = {
  current: 2450000,
  history: [2200000, 2230000, 2280000, 2300000, 2350000, 2400000, 2420000, 2450000],
  topMovers: [
    { name: "Stocks Portfolio", delta: 35000 },
    { name: "Home Value", delta: 12000 },
    { name: "Credit Card Debt", delta: -8000 },
  ],
};

export default function NetWorth() {
  const [data] = createResource(() => api.get<NetWorthData>("/v1/networth").catch(() => SAMPLE));

  return (
    <>
      <PageHeader title="Net Worth" actions={
        <button type="button" aria-label="Add snapshot" class="w-10 h-10 flex items-center justify-center rounded-full bg-surface text-text active:scale-95 transition-transform">
          <Plus size={20} />
        </button>
      } />
      <div class="p-4 md:p-6 space-y-3 max-w-5xl">
        <Show when={data.loading}>
          <SkeletonBlock class="min-h-[200px]" />
        </Show>
        <Show when={data()}>
          {(d) => (
            <>
              <BentoBlock size="lg">
                <Stat label="Net Worth" value={formatCurrency(d().current)} size="xl" tone={d().current >= 0 ? "primary" : "accent"} />
              </BentoBlock>
              <BentoBlock size="md">
                <div class="flex items-center justify-between mb-3">
                  <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide">12-month trend</span>
                  <BarChart3 size={16} class="text-muted" />
                </div>
                <Show when={d().history && d().history.length > 1} fallback={<p class="text-muted text-sm py-4 text-center">Not enough data for a trend yet.</p>}>
                  <Sparkline values={d().history} width={undefined} height={120} tone={d().current >= 0 ? "primary" : "accent"} class="w-full" />
                </Show>
              </BentoBlock>
              <BentoBlock size="md">
                <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-3 block">Top Movers</span>
                <ul class="flex flex-col">
                  <For each={d().topMovers}>
                    {(m) => (
                      <li class="flex items-center justify-between py-3 border-b border-border last:border-0">
                        <div class="flex items-center gap-2">
                          {m.delta >= 0 ? <TrendingUp size={16} class="text-primary" /> : <TrendingDown size={16} class="text-accent" />}
                          <span class="font-body text-base text-text">{m.name}</span>
                        </div>
                        <span class={`font-display font-semibold text-base ${m.delta >= 0 ? "text-primary" : "text-accent"}`}>
                          {m.delta >= 0 ? "+" : "−"}{formatCurrency(Math.abs(m.delta))}
                        </span>
                      </li>
                    )}
                  </For>
                </ul>
              </BentoBlock>
            </>
          )}
        </Show>
        <Show when={data.error && !data()}>
          <EmptyState icon={BarChart3} title="Couldn't load net worth" body="Try again later or add a snapshot manually." />
        </Show>
      </div>
    </>
  );
}
