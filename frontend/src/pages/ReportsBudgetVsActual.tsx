import { createResource, For, Show } from "solid-js";
import { Target } from "lucide-solid";
import { api } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { CategoryBar } from "../components/ui/category-bar";
import { EmptyState } from "../components/ui/empty-state";
import { SkeletonBlock } from "../components/ui/skeleton";

interface BudgetItem { id: string; name: string; spent: number; amount: unknown; currency: string; }

function numericToFloat(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v) || 0;
  if (v && typeof v === "object" && "Int" in (v as any)) {
    const o = v as { Int: number; Exp: number; Valid: boolean };
    if (!o.Valid) return 0;
    return o.Int * Math.pow(10, o.Exp);
  }
  return 0;
}

export default function ReportsBudgetVsActual() {
  const [budgets] = createResource(() => api.get<BudgetItem[]>("/v1/budgets"));

  return (
    <>
      <PageHeader title="Budget vs Actual" back />
      <div class="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <Show when={budgets.loading}>
          <SkeletonBlock class="min-h-[100px]" />
          <SkeletonBlock class="min-h-[100px]" />
          <SkeletonBlock class="min-h-[100px]" />
        </Show>
        <Show when={budgets.error}>
          <p class="text-accent text-sm py-6 text-center col-span-1 md:col-span-2 lg:col-span-3">Failed to load budgets.</p>
        </Show>
        <Show when={!budgets.loading && !budgets.error && (budgets() ?? []).length === 0}>
          <div class="col-span-1 md:col-span-2 lg:col-span-3">
            <EmptyState icon={Target} title="No budgets yet" body="Create budgets to compare planned vs actual spending." />
          </div>
        </Show>
        <For each={budgets() ?? []}>
          {(b) => {
            const amount = numericToFloat(b.amount);
            const pct = amount > 0 ? (b.spent / amount) * 100 : 0;
            const over = b.spent > amount;
            return (
              <BentoBlock size="sm">
                <div class="flex items-center justify-between mb-2">
                  <span class="font-display text-lg font-bold text-text">{b.name}</span>
                  <span class="text-sm text-muted">{formatCurrency(b.spent, b.currency)} / {formatCurrency(amount, b.currency)}</span>
                </div>
                <CategoryBar value={pct / 100} color={over ? "var(--color-accent)" : "var(--color-primary)"} trackColor="bg-bg" />
              </BentoBlock>
            );
          }}
        </For>
      </div>
    </>
  );
}
