import { createMemo, createResource, For, Show } from "solid-js";
import { BarChart3 } from "lucide-solid";
import { api } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { DonutChart } from "../components/ui/donut-chart";
import { CategoryBar } from "../components/ui/category-bar";
import { EmptyState } from "../components/ui/empty-state";
import { SkeletonBlock } from "../components/ui/skeleton";

interface SummaryData {
  category_spending: Array<{ category_id: string; category_name: string; color: string; total: number }>;
}

export default function ReportsCategoryBreakdown() {
  const [summary] = createResource(() => api.get<SummaryData>("/v1/summary"));
  const segments = createMemo(() =>
    (summary()?.category_spending ?? []).map((r) => ({ label: r.category_name, value: r.total, color: r.color || undefined }))
  );
  const total = createMemo(() => segments().reduce((s, x) => s + x.value, 0));

  return (
    <>
      <PageHeader title="Category Breakdown" back />
      <div class="p-4 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4">
        <Show when={summary.loading}>
          <SkeletonBlock class="col-span-1 md:col-span-5 min-h-[380px]" />
          <SkeletonBlock class="col-span-1 md:col-span-7 min-h-[380px]" />
        </Show>
        <Show when={summary.error}>
          <p class="text-accent text-sm py-6 text-center col-span-1 md:col-span-12">Failed to load data.</p>
        </Show>
        <Show when={!summary.loading && summary()}>
          <BentoBlock class="col-span-1 md:col-span-5 flex items-center justify-center min-h-[380px]">
            <Show
              when={segments().length > 0}
              fallback={<EmptyState icon={BarChart3} title="No category data" body="Add expense transactions to see breakdown." />}
            >
              <DonutChart segments={segments()} centerLabel="Total Spent" centerValue={formatCurrency(total())} size={300} thickness={36} />
            </Show>
          </BentoBlock>
          <BentoBlock class="col-span-1 md:col-span-7 flex flex-col min-h-[380px]">
            <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-4 block">Breakdown</span>
            <Show when={segments().length > 0} fallback={<p class="text-sm text-muted py-4">No data yet.</p>}>
              <ul class="flex flex-col gap-3">
                <For each={segments()}>
                  {(seg) => {
                    const pct = total() > 0 ? (seg.value / total()) * 100 : 0;
                    return (
                      <li class="flex items-center gap-3">
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center justify-between mb-1.5">
                            <span class="font-body text-sm text-text">{seg.label}</span>
                            <span class="font-display text-sm font-semibold text-text">{formatCurrency(seg.value)}</span>
                          </div>
                          <div class="flex items-center gap-2">
                            <CategoryBar value={pct / 100} color={seg.color || "var(--color-primary)"} trackColor="bg-bg" class="flex-1" />
                            <span class="text-[12px] font-mono text-muted w-10 text-right">{pct.toFixed(0)}%</span>
                          </div>
                        </div>
                      </li>
                    );
                  }}
                </For>
              </ul>
            </Show>
          </BentoBlock>
        </Show>
      </div>
    </>
  );
}
