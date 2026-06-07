import { createResource, createSignal, For, Show } from "solid-js";
import { Plus, Target } from "lucide-solid";
import { api } from "../lib/api";
import { formatCurrency, numericToFloat, pgTextToString } from "../lib/format";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { CategoryBar } from "../components/ui/category-bar";
import { SkeletonBlock } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";
import { Sheet } from "../components/ui/sheet";
import { BudgetForm } from "../components/forms/budget-form";

interface Budget {
  id: string;
  name: string;
  amount: unknown;       // pgtype.Numeric
  currency: string;
  period_type: string;
  category_name: unknown; // pgtype.Text
  spent: number;         // computed float by handler
  remaining: number;
  spent_pct: number;
}

export default function Budgets() {
  const [budgets, { refetch }] = createResource(() => api.get<Budget[]>("/v1/budgets"));
  const [sheetOpen, setSheetOpen] = createSignal(false);

  function openSheet() { setSheetOpen(true); }
  function closeSheet() { setSheetOpen(false); }
  function handleSuccess() { closeSheet(); refetch(); }

  return (
    <>
      <PageHeader
        title="Budgets"
        actions={
          <button
            type="button"
            aria-label="Add budget"
            onClick={openSheet}
            class="w-10 h-10 flex items-center justify-center rounded-full bg-surface text-text active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <Plus size={20} />
          </button>
        }
      />
      <div class="p-4 md:p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <Show when={budgets.loading}>
            <SkeletonBlock class="min-h-[140px]" />
            <SkeletonBlock class="min-h-[140px]" />
          </Show>
          <Show when={budgets.error}>
            <div class="col-span-1 md:col-span-2 lg:col-span-3">
              <p class="text-accent text-sm py-6 text-center">Failed to load budgets.</p>
            </div>
          </Show>
          <Show when={!budgets.loading && !budgets.error && (budgets() ?? []).length === 0}>
            <div class="col-span-1 md:col-span-2 lg:col-span-3">
              <EmptyState
                icon={Target}
                title="No budgets yet"
                body="Set spending limits to stay on track."
                action={{ label: "Create your first budget", onClick: openSheet }}
              />
            </div>
          </Show>
          <For each={budgets() ?? []}>
            {(b) => {
              const amount = numericToFloat(b.amount);
              const pct = () => Math.min(amount > 0 ? (b.spent / amount) * 100 : 0, 100);
              const over = () => b.spent > amount;
              const catName = pgTextToString(b.category_name);
              return (
                <BentoBlock variant="pressable" size="md">
                  <div class="flex flex-col gap-2">
                    <div class="flex items-baseline justify-between">
                      <span class="font-display text-xl font-bold text-text">{b.name}</span>
                      <span class={`text-[13px] font-medium ${over() ? "text-accent" : "text-muted"}`}>
                        {pct().toFixed(0)}% used
                      </span>
                    </div>
                    <div class="flex items-baseline justify-between">
                      <span class="text-sm text-muted">
                        {formatCurrency(b.spent, b.currency)} of {formatCurrency(amount, b.currency)}
                      </span>
                      <span class="text-[12px] font-body uppercase tracking-wide text-muted">
                        {b.period_type}{catName ? ` · ${catName}` : ""}
                      </span>
                    </div>
                    <CategoryBar
                      value={pct() / 100}
                      color={over() ? "var(--color-accent)" : "var(--color-primary)"}
                      trackColor="bg-bg"
                    />
                  </div>
                </BentoBlock>
              );
            }}
          </For>
          <BentoBlock
            variant="dashed"
            size="md"
            class="flex items-center justify-center"
          >
            <button
              type="button"
              onClick={openSheet}
              class="flex flex-col items-center gap-1 text-muted hover:text-text transition-colors"
            >
              <Target size={20} />
              <span class="text-sm font-medium">Create your first budget</span>
            </button>
          </BentoBlock>
        </div>
      </div>

      <Sheet open={sheetOpen()} onClose={closeSheet} title="Create Budget">
        <BudgetForm onSuccess={handleSuccess} onClose={closeSheet} />
      </Sheet>
    </>
  );
}
