import { createResource, createSignal, For, Show } from "solid-js";
import { PiggyBank } from "lucide-solid";
import { api } from "../lib/api";
import { numericToFloat, pgDateToString } from "../lib/format";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { Badge } from "../components/ui/badge";
import { ProgressBar } from "../components/ui/progress-bar";
import { Eyebrow } from "../components/ui/eyebrow";
import { Money } from "../components/ui/money";
import { SkeletonBlock } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";
import { Sheet } from "../components/ui/sheet";
import { SavingsForm } from "../components/forms/savings-form";
import { AddButton, RowActions, shortDate } from "../components/wealth/common";

interface SavingsGoal {
  id: string;
  name: string;
  description: { String: string; Valid: boolean };
  target_amount: unknown;
  current_amount: unknown;
  currency: string;
  deadline: unknown;
  status: "active" | "achieved" | "abandoned";
  linked_account_id: unknown;
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

  function statusBadgeVariant(s: string): "success" | "default" | "outline" {
    if (s === "achieved") return "success";
    if (s === "active") return "default";
    return "outline";
  }

  const totals = () => {
    const active = (goals() ?? []).filter((g) => g.status !== "abandoned");
    return {
      saved: active.reduce((n, g) => n + numericToFloat(g.current_amount), 0),
      target: active.reduce((n, g) => n + numericToFloat(g.target_amount), 0),
    };
  };

  return (
    <>
      <PageHeader title="Savings goals" actions={<AddButton label="New goal" onClick={openSheet} />} />

      <div class="px-5 md:px-7 py-5 md:py-6 flex flex-col gap-4">
        <Show when={(goals() ?? []).length > 0 && totals().target > 0}>
          <BentoBlock class="flex flex-col gap-3">
            <Eyebrow>Saved across goals</Eyebrow>
            <div class="flex items-baseline gap-2 flex-wrap">
              <Money value={totals().saved} mutedSymbol class="text-[30px] leading-none tracking-[-0.04em]" />
              <span class="font-mono tabular text-[13px] text-muted">of <Money value={totals().target} tone="muted" /></span>
            </div>
            <ProgressBar
              pct={(totals().saved / totals().target) * 100}
              tone={totals().saved >= totals().target ? "bg-pos" : "bg-signal"}
              label="Saved across all goals"
            />
          </BentoBlock>
        </Show>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Show when={goals.loading}>
            <SkeletonBlock class="min-h-[160px]" />
            <SkeletonBlock class="min-h-[160px]" />
          </Show>
          <Show when={goals.error}>
            <p class="md:col-span-2 lg:col-span-3 text-neg text-[14px] py-6 text-center">Failed to load savings goals.</p>
          </Show>
          <Show when={!goals.loading && !goals.error && (goals() ?? []).length === 0}>
            <div class="md:col-span-2 lg:col-span-3">
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
              const progress = () => (target() > 0 ? (current() / target()) * 100 : 0);
              const deadlineStr = () => pgDateToString(g.deadline);
              return (
                <BentoBlock class={`group flex flex-col gap-3 ${g.status === "abandoned" ? "opacity-60" : ""}`}>
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                      <div class="text-[15px] font-medium text-text leading-snug">{g.name}</div>
                      <Show when={g.description?.Valid && g.description.String}>
                        <div class="text-[12.5px] text-muted mt-0.5 line-clamp-2">{g.description.String}</div>
                      </Show>
                    </div>
                    <div class="flex items-center gap-1 shrink-0">
                      <Badge variant={statusBadgeVariant(g.status)} class="capitalize">{g.status}</Badge>
                      <RowActions name={g.name} onEdit={() => { setEditGoal(g); setEditSheetOpen(true); }} onDelete={() => handleDelete(g.id, g.name)} class="-mr-2" />
                    </div>
                  </div>
                  <div class="flex items-baseline justify-between gap-2">
                    <span class="font-mono tabular text-[13px] text-muted">
                      <Money value={current()} currency={g.currency} class="text-[17px] tracking-[-0.03em]" /> of <Money value={target()} currency={g.currency} tone="muted" />
                    </span>
                    <span class="font-mono tabular text-[12px] text-muted">{Math.min(999, Math.round(progress()))}%</span>
                  </div>
                  <ProgressBar
                    pct={progress()}
                    tone={progress() >= 100 || g.status === "achieved" ? "bg-pos" : "bg-signal"}
                    label={`${g.name} progress`}
                  />
                  <Show when={deadlineStr()}>
                    <span class="font-mono tabular text-[12px] text-muted">due {shortDate(deadlineStr())}</span>
                  </Show>
                </BentoBlock>
              );
            }}
          </For>
        </div>
      </div>

      <Sheet open={sheetOpen()} onClose={closeSheet} title="New savings goal">
        <SavingsForm onSuccess={handleSuccess} onClose={closeSheet} />
      </Sheet>

      <Sheet open={editSheetOpen()} onClose={closeEdit} title="Edit savings goal">
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
                description: g().description,
                linked_account_id: g().linked_account_id,
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
