import { createResource, createSignal, For, Show } from "solid-js";
import { PiggyBank, Plus, Pencil, Trash2 } from "lucide-solid";
import { api } from "../lib/api";
import { formatCurrency, numericToFloat, pgDateToString } from "../lib/format";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { Badge } from "../components/ui/badge";
import { CategoryBar } from "../components/ui/category-bar";
import { SkeletonBlock } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";
import { Sheet } from "../components/ui/sheet";
import { SavingsForm } from "../components/forms/savings-form";

interface SavingsGoal {
  id: string;
  name: string;
  description: { String: string; Valid: boolean };
  target_amount: unknown;
  current_amount: unknown;
  currency: string;
  deadline: unknown;
  status: "active" | "achieved" | "abandoned";
}

export default function Savings() {
  const [sheetOpen, setSheetOpen] = createSignal(false);
  const [editGoal, setEditGoal] = createSignal<SavingsGoal | null>(null);
  const [editSheetOpen, setEditSheetOpen] = createSignal(false);

  const [goals, { refetch }] = createResource(() => api.get<SavingsGoal[]>("/v1/savings"));

  function openSheet() { setSheetOpen(true); }
  function closeSheet() { setSheetOpen(false); }
  function handleSuccess() { closeSheet(); refetch(); }

  function closeEdit() { setEditSheetOpen(false); setEditGoal(null); }
  function handleEditSuccess() { closeEdit(); refetch(); }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await api.delete(`/v1/savings/${id}`);
      refetch();
    } catch {
      alert("Failed to delete savings goal.");
    }
  }

  function statusBadgeVariant(s: string): "success" | "outline" {
    if (s === "active" || s === "achieved") return "success";
    return "outline";
  }

  return (
    <>
      <PageHeader
        title="Savings Goals"
        actions={
          <button
            type="button"
            aria-label="Add savings goal"
            onClick={openSheet}
            class="w-10 h-10 flex items-center justify-center rounded-full bg-surface text-text active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <Plus size={20} />
          </button>
        }
      />

      <div class="p-4 md:p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <Show when={goals.loading}>
            <SkeletonBlock class="min-h-[160px]" />
            <SkeletonBlock class="min-h-[160px]" />
          </Show>
          <Show when={goals.error}>
            <div class="col-span-1 md:col-span-2 lg:col-span-3">
              <p class="text-accent text-sm py-6 text-center">Failed to load savings goals.</p>
            </div>
          </Show>
          <Show when={!goals.loading && !goals.error && (goals() ?? []).length === 0}>
            <div class="col-span-1 md:col-span-2 lg:col-span-3">
              <EmptyState
                icon={PiggyBank}
                title="No savings goals yet"
                body="Create a goal to start tracking your progress."
                action={{ label: "Add your first goal", onClick: openSheet }}
              />
            </div>
          </Show>
          <For each={goals() ?? []}>
            {(g) => {
              const target = () => numericToFloat(g.target_amount);
              const current = () => numericToFloat(g.current_amount);
              const progress = () => target() > 0 ? Math.min(current() / target(), 1) : 0;
              const deadlineStr = () => pgDateToString(g.deadline);
              const barColor = () =>
                g.status === "achieved"
                  ? "var(--color-primary)"
                  : "var(--color-primary)";
              return (
                <div class="group relative">
                  <BentoBlock variant="pressable">
                    <div class="flex flex-col gap-2">
                      <div class="flex items-start justify-between gap-2">
                        <span class="font-display text-lg font-bold text-text leading-tight">{g.name}</span>
                        <Badge variant={statusBadgeVariant(g.status)} class="shrink-0 capitalize">
                          {g.status}
                        </Badge>
                      </div>
                      <div class="flex items-baseline justify-between text-sm">
                        <span class="text-muted">
                          {formatCurrency(current(), g.currency)}
                          {" / "}
                          {formatCurrency(target(), g.currency)}
                        </span>
                        <span class="text-muted">{(progress() * 100).toFixed(0)}%</span>
                      </div>
                      <CategoryBar
                        value={progress()}
                        color={barColor()}
                        trackColor="bg-bg"
                      />
                      <Show when={deadlineStr()}>
                        <span class="text-[12px] text-muted font-body">Due {deadlineStr()}</span>
                      </Show>
                    </div>
                  </BentoBlock>
                  <div class="absolute top-3 right-3 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setEditGoal(g); setEditSheetOpen(true); }}
                      aria-label={`Edit ${g.name}`}
                      class="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-hover text-muted hover:text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDelete(g.id, g.name); }}
                      aria-label={`Delete ${g.name}`}
                      class="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-hover text-muted hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </div>

      <Sheet open={sheetOpen()} onClose={closeSheet} title="New Savings Goal">
        <SavingsForm onSuccess={handleSuccess} onClose={closeSheet} />
      </Sheet>

      <Sheet open={editSheetOpen()} onClose={closeEdit} title="Edit Savings Goal">
        <Show when={editGoal()}>
          {(g) => (
            <SavingsForm
              existing={{
                id: g().id,
                name: g().name,
                target_amount: g().target_amount,
                current_amount: g().current_amount,
                currency: g().currency,
                deadline: g().deadline,
                status: g().status,
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
