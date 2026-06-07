import { createResource, For, Show } from "solid-js";
import { Plus, Target } from "lucide-solid";
import { api } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { CategoryBar } from "../components/ui/category-bar";
import { SkeletonBlock } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";

interface Budget { id: string; name: string; spent: number; amount: number; period: string; category_name: string; }

const SAMPLE_BUDGETS: Budget[] = [
  { id: "1", name: "Groceries", spent: 4200, amount: 6000, period: "monthly", category_name: "Groceries" },
  { id: "2", name: "Dining Out", spent: 2800, amount: 3000, period: "monthly", category_name: "Dining" },
  { id: "3", name: "Transport", spent: 1900, amount: 2000, period: "monthly", category_name: "Transport" },
];

export default function Budgets() {
  const [budgets] = createResource(() =>
    api.get<Budget[]>("/v1/budgets").catch(() => SAMPLE_BUDGETS)
  );

  return (
    <>
      <PageHeader
        title="Budgets"
        actions={
          <button
            type="button"
            aria-label="Add budget"
            class="w-10 h-10 flex items-center justify-center rounded-full bg-surface text-text active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <Plus size={20} />
          </button>
        }
      />
      <div class="p-4 md:p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl">
          <Show when={budgets.loading}>
            <SkeletonBlock class="min-h-[140px]" />
            <SkeletonBlock class="min-h-[140px]" />
          </Show>
          <Show when={!budgets.loading && (budgets() ?? []).length === 0}>
            <div class="col-span-1 md:col-span-2">
              <EmptyState
                icon={Target}
                title="No budgets yet"
                body="Set spending limits to stay on track."
                action={{ label: "Create your first budget", onClick: () => {} }}
              />
            </div>
          </Show>
          <For each={budgets() ?? []}>
            {(b) => {
              const pct = () => Math.min((b.spent / b.amount) * 100, 100);
              const over = () => b.spent > b.amount;
              return (
                <BentoBlock
                  variant="pressable"
                  size="md"
                  onClick={() => { /* TODO: edit sheet */ }}
                >
                  <div class="flex flex-col gap-2">
                    <div class="flex items-baseline justify-between">
                      <span class="font-display text-xl font-bold text-text">{b.name}</span>
                      <span
                        class={`text-[13px] font-medium ${
                          over() ? "text-accent" : "text-muted"
                        }`}
                      >
                        {pct().toFixed(0)}% used
                      </span>
                    </div>
                    <div class="flex items-baseline justify-between">
                      <span class="text-sm text-muted">
                        {formatCurrency(b.spent)} of {formatCurrency(b.amount)}
                      </span>
                      <span class="text-[12px] font-body uppercase tracking-wide text-muted">
                        {b.period}
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
              class="flex flex-col items-center gap-1 text-muted hover:text-text transition-colors"
            >
              <Target size={20} />
              <span class="text-sm font-medium">Create your first budget</span>
            </button>
          </BentoBlock>
        </div>
      </div>
    </>
  );
}
