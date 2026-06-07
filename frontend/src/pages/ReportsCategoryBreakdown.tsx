import { createMemo, createResource, Show } from "solid-js";
import { BarChart3 } from "lucide-solid";
import { api } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { DonutChart } from "../components/ui/donut-chart";
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
      <div class="p-4 md:p-6">
        <Show when={summary.loading}>
          <SkeletonBlock class="min-h-[340px]" />
        </Show>
        <Show when={summary.error}>
          <p class="text-accent text-sm py-6 text-center">Failed to load data.</p>
        </Show>
        <Show when={!summary.loading && summary()}>
          <BentoBlock size="lg" class="flex items-center justify-center min-h-[340px]">
            <Show
              when={segments().length > 0}
              fallback={<EmptyState icon={BarChart3} title="No category data" body="Add expense transactions to see breakdown." />}
            >
              <DonutChart segments={segments()} centerLabel="Total Spent" centerValue={formatCurrency(total())} size={300} thickness={36} />
            </Show>
          </BentoBlock>
        </Show>
      </div>
    </>
  );
}
