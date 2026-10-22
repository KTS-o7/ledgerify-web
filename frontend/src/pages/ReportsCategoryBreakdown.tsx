import { createResource, createSignal, Show } from "solid-js";
import { ChartPie } from "lucide-solid";
import { api } from "../lib/api";
import { onDataChanged } from "../lib/events";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { EmptyState } from "../components/ui/empty-state";
import { SkeletonBlock } from "../components/ui/skeleton";
import { MonthPicker, currentMonth } from "../components/ui/month-picker";
import { Eyebrow } from "../components/ui/eyebrow";
import { CategoryBreakdown, type CategoryTotal } from "../components/insights/category-breakdown";

interface SummaryData {
  category_spending: CategoryTotal[] | null;
}

export default function ReportsCategoryBreakdown() {
  const [month, setMonth] = createSignal(currentMonth());
  const [summary, { refetch }] = createResource(month, (m) => api.get<SummaryData>(`/v1/summary?month=${m}`));
  onDataChanged(() => refetch());
  const rows = () => summary()?.category_spending ?? [];

  return (
    <>
      <PageHeader title="Categories" back actions={<MonthPicker value={month()} onChange={setMonth} />} />
      <div class="px-5 md:px-7 py-5 md:py-6">
        <Show when={summary.loading}>
          <SkeletonBlock class="min-h-[320px]" />
        </Show>
        <Show when={summary.error}>
          <p class="text-neg text-sm py-6 text-center">Failed to load data.</p>
        </Show>
        <Show when={!summary.loading && summary()}>
          <BentoBlock>
            <Eyebrow as="h2" class="mb-5 block">Spending by category</Eyebrow>
            <Show
              when={rows().some((r) => r.total > 0)}
              fallback={<EmptyState icon={ChartPie} title="Nothing spent yet" body="Add expense transactions to see the breakdown." />}
            >
              <CategoryBreakdown rows={rows()} centerLabel="Spent" />
            </Show>
          </BentoBlock>
        </Show>
      </div>
    </>
  );
}
