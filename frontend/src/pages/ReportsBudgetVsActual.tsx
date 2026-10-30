import { createResource, Show } from "solid-js";
import { Target } from "lucide-solid";
import { api } from "../lib/api";
import { onDataChanged } from "../lib/events";
import { PageHeader } from "../components/ui/page-header";
import { EmptyState } from "../components/ui/empty-state";
import { SkeletonBlock } from "../components/ui/skeleton";
import { BudgetList, BudgetSummary, type Budget } from "../components/insights/budget-list";

export default function ReportsBudgetVsActual() {
  const [budgets, { refetch }] = createResource(() => api.get<Budget[]>("/v1/budgets"));
  onDataChanged(() => refetch());
  const list = () => budgets() ?? [];

  return (
    <>
      <PageHeader title="Budget vs actual" back />
      <div class="px-5 md:px-7 py-5 md:py-6">
        <Show when={budgets.loading}>
          <div class="grid grid-cols-1 md:grid-cols-12 gap-4">
            <SkeletonBlock class="md:col-span-5 h-[150px]" />
            <SkeletonBlock class="md:col-span-7 h-[240px]" />
          </div>
        </Show>
        <Show when={budgets.error}>
          <p class="text-neg text-sm py-6 text-center">Failed to load budgets.</p>
        </Show>
        <Show when={!budgets.loading && !budgets.error && list().length === 0}>
          <EmptyState icon={Target} title="No budgets yet" body="Create budgets to compare planned against actual spending." />
        </Show>
        <Show when={!budgets.loading && list().length > 0}>
          <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            <div class="md:col-span-5"><BudgetSummary budgets={list()} /></div>
            <div class="md:col-span-7"><BudgetList budgets={list()} /></div>
          </div>
        </Show>
      </div>
    </>
  );
}
