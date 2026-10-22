import { createMemo, createResource, createSignal, Match, Show, Switch } from "solid-js";
import { A } from "@solidjs/router";
import { ChartPie, Target } from "lucide-solid";
import { api } from "../lib/api";
import { onDataChanged } from "../lib/events";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { SegmentedControl } from "../components/ui/segmented-control";
import { EmptyState } from "../components/ui/empty-state";
import { SkeletonBlock } from "../components/ui/skeleton";
import { MonthPicker, addMonths, currentMonth } from "../components/ui/month-picker";
import { Stat } from "../components/ui/stat";
import { Eyebrow } from "../components/ui/eyebrow";
import { formatCurrency } from "../lib/format";
import { CategoryBreakdown, type CategoryTotal } from "../components/insights/category-breakdown";
import { BudgetList, BudgetSummary, type Budget } from "../components/insights/budget-list";
import { pctChange } from "../components/insights/budget-math";

type Mode = "spending" | "income" | "budgets";

interface SummaryData {
  total_income: number;
  total_expenses: number;
  category_spending: CategoryTotal[] | null;
  income_category_spending: CategoryTotal[] | null;
}

function monthShort(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "short" });
}

export default function Analytics() {
  const [mode, setMode] = createSignal<Mode>("spending");
  const [month, setMonth] = createSignal(currentMonth());

  const [summary, { refetch }] = createResource(month, (m) => api.get<SummaryData>(`/v1/summary?month=${m}`));
  // Previous month only feeds the delta under the donut; a failure just hides it.
  const [prev, { refetch: refetchPrev }] = createResource(month, (m) =>
    api.get<SummaryData>(`/v1/summary?month=${addMonths(m, -1)}`).catch(() => null),
  );
  const [budgets, { refetch: refetchBudgets }] = createResource(
    () => (mode() === "budgets" ? true : undefined),
    () => api.get<Budget[]>("/v1/budgets"),
  );
  onDataChanged(() => { refetch(); refetchPrev(); if (mode() === "budgets") refetchBudgets(); });

  const isIncome = () => mode() === "income";
  const rows = createMemo(() => {
    const s = summary();
    if (!s) return [];
    return (isIncome() ? s.income_category_spending : s.category_spending) ?? [];
  });

  const trend = createMemo(() => {
    const cur = summary(), p = prev();
    if (!cur || !p) return undefined;
    const change = isIncome() ? pctChange(cur.total_income, p.total_income) : pctChange(cur.total_expenses, p.total_expenses);
    if (change === null || !isFinite(change)) return undefined;
    const up = change > 0;
    // Spending down is good; income up is good.
    const good = isIncome() ? up : !up;
    return {
      dir: (up ? "up" : "down") as "up" | "down",
      value: `${up ? "+" : "−"}${Math.abs(Math.round(change))}% vs ${monthShort(addMonths(month(), -1))}`,
      tone: (good ? "pos" : "neg") as "pos" | "neg",
    };
  });

  const savedPct = () => {
    const s = summary();
    if (!s || s.total_income <= 0) return null;
    return Math.round(((s.total_income - s.total_expenses) / s.total_income) * 100);
  };

  return (
    <>
      <PageHeader title="Insights" actions={<Show when={mode() !== "budgets"}><MonthPicker value={month()} onChange={setMonth} /></Show>} />
      <div class="px-5 md:px-7 py-5 md:py-6 flex flex-col gap-4">
        <SegmentedControl<Mode>
          class="md:max-w-[420px]"
          options={[
            { value: "spending", label: "Spending" },
            { value: "income", label: "Income" },
            { value: "budgets", label: "Budgets" },
          ]}
          value={mode()}
          onChange={setMode}
          ariaLabel="Insights view"
        />

        <Switch>
          <Match when={mode() === "budgets"}>
            <Show when={!budgets.loading} fallback={<><SkeletonBlock class="h-[150px]" /><SkeletonBlock class="h-[240px]" /></>}>
              <Show when={!budgets.error} fallback={<p class="text-neg text-sm py-6 text-center">Failed to load budgets.</p>}>
                <Show
                  when={(budgets() ?? []).length > 0}
                  fallback={<EmptyState icon={Target} title="No budgets yet" body="Set spending limits to stay on track." />}
                >
                  <div class="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div class="md:col-span-5"><BudgetSummary budgets={budgets() ?? []} /></div>
                    <div class="md:col-span-7"><BudgetList budgets={budgets() ?? []} /></div>
                  </div>
                </Show>
                <A href="/budgets" class="self-start text-[13.5px] font-medium">Manage budgets →</A>
              </Show>
            </Show>
          </Match>

          <Match when={summary.loading}>
            <div class="grid grid-cols-1 md:grid-cols-12 gap-4">
              <SkeletonBlock class="md:col-span-8 min-h-[300px]" />
              <SkeletonBlock class="md:col-span-4 min-h-[300px]" />
            </div>
          </Match>

          <Match when={summary.error}>
            <p class="text-neg text-sm py-6 text-center">Failed to load insights.</p>
          </Match>

          <Match when={summary()}>
            {(s) => (
              <div class="grid grid-cols-1 md:grid-cols-12 gap-4">
                <BentoBlock class="md:col-span-8">
                  <Eyebrow as="h2" class="mb-5 block">{isIncome() ? "Income by category" : "Spending by category"}</Eyebrow>
                  <Show
                    when={rows().some((r) => r.total > 0)}
                    fallback={
                      <EmptyState
                        icon={ChartPie}
                        title={isIncome() ? "No income yet" : "Nothing spent yet"}
                        body={isIncome() ? "Income you record this month shows up here by category." : "Spending you record this month shows up here by category."}
                      />
                    }
                  >
                    <CategoryBreakdown rows={rows()} centerLabel={isIncome() ? "Earned" : "Spent"} trend={trend()} />
                  </Show>
                </BentoBlock>
                <BentoBlock class="md:col-span-4 flex flex-col gap-5">
                  <Eyebrow as="h2">This month</Eyebrow>
                  <div class="grid grid-cols-3 md:grid-cols-1 gap-4 md:gap-5">
                    <Stat label="In" value={formatCurrency(s().total_income)} tone="pos" />
                    <Stat label="Out" value={formatCurrency(s().total_expenses)} />
                    <Stat
                      label="Saved"
                      value={savedPct() === null ? "—" : `${savedPct()}%`}
                      tone={savedPct() !== null && savedPct()! < 0 ? "neg" : "default"}
                    />
                  </div>
                  <A href="/reports/cashflow" class="mt-auto text-[13.5px] font-medium">Cash flow report →</A>
                </BentoBlock>
              </div>
            )}
          </Match>
        </Switch>
      </div>
    </>
  );
}
