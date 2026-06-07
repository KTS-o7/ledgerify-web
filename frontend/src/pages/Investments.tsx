import { createResource, For, Show } from "solid-js";
import { Plus, TrendingUp } from "lucide-solid";
import { api } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { Sparkline } from "../components/ui/sparkline";
import { SkeletonBlock } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";

interface Holding { id: string; ticker: string; name: string; quantity: number; current_price: number; market_value: number; history?: number[]; }

const SAMPLE_HOLDINGS: Holding[] = [
  { id: "1", ticker: "AAPL", name: "Apple Inc.", quantity: 10, current_price: 178, market_value: 1780, history: [170, 172, 168, 175, 178, 180, 178] },
  { id: "2", ticker: "MSFT", name: "Microsoft", quantity: 5, current_price: 410, market_value: 2050, history: [400, 405, 410, 408, 412, 415, 410] },
  { id: "3", ticker: "VOO", name: "Vanguard S&P 500 ETF", quantity: 12, current_price: 480, market_value: 5760, history: [470, 475, 478, 482, 485, 488, 480] },
];

export default function Investments() {
  const [holdings] = createResource(() => api.get<Holding[]>("/v1/investments").catch(() => SAMPLE_HOLDINGS));

  return (
    <>
      <PageHeader title="Investments" actions={
        <button type="button" aria-label="Add investment" class="w-10 h-10 flex items-center justify-center rounded-full bg-surface text-text active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg">
          <Plus size={20} />
        </button>
      } />
      <div class="p-4 md:p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-4xl">
          <Show when={holdings.loading}>
            <SkeletonBlock class="min-h-[120px]" />
            <SkeletonBlock class="min-h-[120px]" />
          </Show>
          <Show when={!holdings.loading && (holdings() ?? []).length === 0}>
            <div class="col-span-1 md:col-span-2">
              <EmptyState icon={TrendingUp} title="No investments yet" body="Track your portfolio across stocks, ETFs, and funds." action={{ label: "Add holding", onClick: () => {} }} />
            </div>
          </Show>
          <For each={holdings() ?? []}>
            {(h) => (
              <BentoBlock variant="pressable" size="sm" onClick={() => { /* TODO */ }}>
                <div class="flex items-center gap-3">
                  <div class="flex-1 min-w-0">
                    <div class="font-mono text-lg font-semibold text-text">{h.ticker}</div>
                    <div class="text-sm text-muted truncate">{h.name}</div>
                    <div class="font-mono text-sm text-muted mt-1">{h.quantity} × {formatCurrency(h.current_price)}</div>
                    <div class="font-display text-lg font-bold text-text mt-1">{formatCurrency(h.market_value)}</div>
                  </div>
                  <Show when={h.history && h.history.length > 1}>
                    <Sparkline values={h.history!} width={120} height={40} tone="primary" />
                  </Show>
                </div>
              </BentoBlock>
            )}
          </For>
        </div>
      </div>
    </>
  );
}
