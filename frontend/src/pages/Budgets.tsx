import { createResource, createSignal, Show } from "solid-js";
import { Plus, Target } from "lucide-solid";
import { api } from "../lib/api";
import { onDataChanged } from "../lib/events";
import { PageHeader } from "../components/ui/page-header";
import { SkeletonBlock } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";
import { Sheet } from "../components/ui/sheet";
import { Button } from "../components/ui/button";
import { BudgetForm } from "../components/forms/budget-form";
import { BudgetList, BudgetSummary, type Budget } from "../components/insights/budget-list";

export default function Budgets() {
  const [budgets, { refetch }] = createResource(() => api.get<Budget[]>("/v1/budgets"));
  const [sheetOpen, setSheetOpen] = createSignal(false);
  const [editBudget, setEditBudget] = createSignal<Budget | null>(null);
  const [editSheetOpen, setEditSheetOpen] = createSignal(false);

  // A transaction added from the shell changes "spent".
  onDataChanged(() => refetch());

  function openSheet() { setSheetOpen(true); }
  function closeSheet() { setSheetOpen(false); }
  function handleSuccess() { closeSheet(); refetch(); }

  function closeEdit() { setEditSheetOpen(false); setEditBudget(null); }
  function handleEditSuccess() { closeEdit(); refetch(); }

  async function handleDelete(b: Budget) {
    if (!confirm(`Delete "${b.name}"?`)) return;
    try {
      await api.delete(`/v1/budgets/${b.id}`);
      refetch();
    } catch {
      alert("Failed to delete budget.");
    }
  }

  const list = () => budgets() ?? [];

  return (
    <>
      <PageHeader
        title="Budgets"
        meta={list().length > 0 ? String(list().length) : undefined}
        actions={
          <>
            <Button size="sm" class="hidden md:inline-flex" onClick={openSheet}>
              <Plus size={15} /> New budget
            </Button>
            <button
              type="button"
              aria-label="Add budget"
              onClick={openSheet}
              class="md:hidden w-9 h-9 flex items-center justify-center rounded-full text-text hover:bg-raised active:scale-[0.96] transition-[transform,background-color] duration-[90ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
            >
              <Plus size={20} />
            </button>
          </>
        }
      />
      <div class="px-5 md:px-7 py-5 md:py-6">
        <Show when={budgets.loading}>
          <div class="grid grid-cols-1 md:grid-cols-12 gap-4">
            <SkeletonBlock class="md:col-span-5 h-[150px]" />
            <SkeletonBlock class="md:col-span-7 h-[260px]" />
          </div>
        </Show>
        <Show when={budgets.error}>
          <p class="text-neg text-sm py-6 text-center">Failed to load budgets.</p>
        </Show>
        <Show when={!budgets.loading && !budgets.error && list().length === 0}>
          <EmptyState
            icon={Target}
            title="No budgets yet"
            body="Set spending limits to stay on track."
            action={{ label: "Create your first budget", onClick: openSheet }}
          />
        </Show>
        <Show when={!budgets.loading && list().length > 0}>
          <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            <div class="md:col-span-5 md:sticky md:top-[88px]">
              <BudgetSummary budgets={list()} />
            </div>
            <div class="md:col-span-7">
              <BudgetList
                budgets={list()}
                onEdit={(b) => { setEditBudget(b); setEditSheetOpen(true); }}
                onDelete={handleDelete}
              />
            </div>
          </div>
        </Show>
      </div>

      <Sheet open={sheetOpen()} onClose={closeSheet} title="New budget">
        <BudgetForm onSuccess={handleSuccess} onClose={closeSheet} />
      </Sheet>

      <Sheet open={editSheetOpen()} onClose={closeEdit} title="Edit budget">
        <Show when={editBudget()}>
          {(b) => (
            <BudgetForm
              existing={{
                id: b().id,
                name: b().name,
                amount: b().amount,
                currency: b().currency,
                period_type: b().period_type,
                category_id: b().category_id,
                rollover: b().rollover,
                start_date: b().start_date,
                end_date: b().end_date,
              }}
              onSuccess={handleEditSuccess}
              onClose={closeEdit}
            />
          )}
        </Show>
      </Sheet>
    </>
  );
}
