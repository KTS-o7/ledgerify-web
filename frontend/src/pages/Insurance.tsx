import { createResource, createSignal, For, Show } from "solid-js";
import { Plus, ShieldCheck, Calendar, Pencil, Trash2 } from "lucide-solid";
import { api } from "../lib/api";
import { formatCurrency, numericToFloat, pgTextToString, pgDateToString } from "../lib/format";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { Badge } from "../components/ui/badge";
import { SkeletonBlock } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";
import { Sheet } from "../components/ui/sheet";
import { InsuranceForm } from "../components/forms/insurance-form";

interface Policy {
  id: string;
  name: string;
  provider: unknown;        // pgtype.Text
  policy_type: string;
  premium_amount: unknown;  // pgtype.Numeric
  premium_frequency: string;
  currency: string;
  renewal_date: unknown;    // pgtype.Date
  end_date: unknown;        // pgtype.Date
}

interface FullPolicy {
  id: string;
  name: string;
  policy_type: string;
  provider: unknown;
  premium_frequency: string;
  premium_amount: unknown;
  coverage_amount: unknown;
  currency: string;
  renewal_date: unknown;
}

function renewalStatus(policy: Policy): "active" | "expiring" | "expired" {
  const renewal = pgDateToString(policy.end_date || policy.renewal_date);
  if (!renewal || renewal === "—") return "active";
  const days = (new Date(renewal).getTime() - Date.now()) / 86400000;
  if (days < 0) return "expired";
  if (days < 30) return "expiring";
  return "active";
}

export default function Insurance() {
  const [policies, { refetch }] = createResource(() => api.get<Policy[]>("/v1/insurance"));
  const [sheetOpen, setSheetOpen] = createSignal(false);
  const [editPolicy, setEditPolicy] = createSignal<FullPolicy | null>(null);
  const [editSheetOpen, setEditSheetOpen] = createSignal(false);

  function handleSuccess() {
    setSheetOpen(false);
    refetch();
  }
  function closeEdit() {
    setEditSheetOpen(false);
    setEditPolicy(null);
  }
  function handleEditSuccess() {
    closeEdit();
    refetch();
  }

  async function openEdit(id: string) {
    try {
      const full = await api.get<FullPolicy>(`/v1/insurance/${id}`);
      setEditPolicy(full);
      setEditSheetOpen(true);
    } catch {
      alert("Failed to load policy.");
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await api.delete(`/v1/insurance/${id}`);
      refetch();
    } catch {
      alert("Failed to delete policy.");
    }
  }

  return (
    <>
      <PageHeader title="Insurance" actions={
        <button
          type="button"
          aria-label="Add policy"
          onClick={() => setSheetOpen(true)}
          class="w-10 h-10 flex items-center justify-center rounded-full bg-surface text-text active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <Plus size={20} />
        </button>
      } />
      <div class="p-4 md:p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <Show when={policies.loading}>
            <SkeletonBlock class="min-h-[140px]" />
            <SkeletonBlock class="min-h-[140px]" />
          </Show>
          <Show when={policies.error}>
            <div class="col-span-1 md:col-span-2 lg:col-span-3">
              <p class="text-accent text-sm py-6 text-center">Failed to load policies.</p>
            </div>
          </Show>
          <Show when={!policies.loading && !policies.error && (policies() ?? []).length === 0}>
            <div class="col-span-1 md:col-span-2 lg:col-span-3">
              <EmptyState
                icon={ShieldCheck}
                title="No policies tracked"
                body="Track insurance policies and renewal dates."
                action={{ label: "Add policy", onClick: () => setSheetOpen(true) }}
              />
            </div>
          </Show>
          <For each={policies() ?? []}>
            {(p) => {
              const status = renewalStatus(p);
              const provider = pgTextToString(p.provider);
              const renewalDate = pgDateToString(p.renewal_date || p.end_date);
              return (
                <div class="group relative">
                  <BentoBlock variant="pressable">
                    <div class="flex items-start gap-3">
                      <div class="w-10 h-10 rounded-input bg-bg flex items-center justify-center text-muted flex-shrink-0">
                        <ShieldCheck size={20} />
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1 flex-wrap">
                          <span class="font-display text-lg font-bold text-text">{p.name}</span>
                          <Show when={provider}>
                            <Badge variant="outline">{provider}</Badge>
                          </Show>
                          <Badge variant={status === "active" ? "success" : "destructive"}>
                            {status === "active" ? "Active" : status === "expiring" ? "Expiring soon" : "Expired"}
                          </Badge>
                        </div>
                        <div class="grid grid-cols-2 gap-3 mt-2">
                          <div>
                            <div class="text-[12px] text-muted uppercase tracking-wide">Premium</div>
                            <div class="font-display text-base font-semibold text-text">
                              {formatCurrency(numericToFloat(p.premium_amount), p.currency)}/{p.premium_frequency.slice(0, 2)}
                            </div>
                          </div>
                          <div>
                            <div class="flex items-center gap-1 text-[12px] text-muted uppercase tracking-wide"><Calendar size={12} /> Renews</div>
                            <div class="font-display text-base font-semibold text-text">{renewalDate}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </BentoBlock>
                  <div class="absolute top-3 right-3 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openEdit(p.id); }}
                      aria-label={`Edit ${p.name}`}
                      class="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-hover text-muted hover:text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDelete(p.id, p.name); }}
                      aria-label={`Delete ${p.name}`}
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

      <Sheet open={sheetOpen()} onClose={() => setSheetOpen(false)} title="Add Policy">
        <InsuranceForm onSuccess={handleSuccess} onClose={() => setSheetOpen(false)} />
      </Sheet>

      <Sheet open={editSheetOpen()} onClose={closeEdit} title="Edit Policy">
        <Show when={editPolicy()}>
          {(p) => (
            <InsuranceForm
              existing={{
                id: p().id,
                name: p().name,
                policy_type: p().policy_type,
                provider: p().provider,
                premium_frequency: p().premium_frequency,
                premium_amount: p().premium_amount,
                coverage_amount: p().coverage_amount,
                currency: p().currency,
                renewal_date: p().renewal_date,
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
