import { createResource, createSignal, For, Show } from "solid-js";
import { Plus, ShieldCheck, Calendar, Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-solid";
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
  start_date: unknown;
  nominee: unknown;
  notes: unknown;
}

interface InsurancePayment {
  id: string;
  date: string;
  amount: unknown;
  status: string;
}

function renewalStatus(policy: Policy): "active" | "expiring" | "expired" {
  const renewal = pgDateToString(policy.end_date || policy.renewal_date);
  if (!renewal || renewal === "—") return "active";
  const days = (new Date(renewal).getTime() - Date.now()) / 86400000;
  if (days < 0) return "expired";
  if (days < 30) return "expiring";
  return "active";
}

function InsurancePayments(props: { policyId: string; currency: string }) {
  const [payments, { refetch }] = createResource(
    () => props.policyId,
    (id) => api.get<InsurancePayment[]>(`/v1/insurance/${id}/payments`).catch(() => [] as InsurancePayment[])
  );
  const [showForm, setShowForm] = createSignal(false);
  const [payAmount, setPayAmount] = createSignal("");
  const [payDate, setPayDate] = createSignal(new Date().toISOString().slice(0, 10));
  const [payStatus, setPayStatus] = createSignal("paid");
  const [submitting, setSubmitting] = createSignal(false);

  async function handleAdd(e: SubmitEvent) {
    e.preventDefault();
    if (!payAmount() || !payDate()) return;
    setSubmitting(true);
    try {
      await api.post(`/v1/insurance/${props.policyId}/payments`, {
        amount: parseFloat(payAmount()),
        date: payDate(),
        status: payStatus(),
      });
      setPayAmount("");
      setShowForm(false);
      refetch();
    } catch {
      alert("Failed to add payment.");
    } finally {
      setSubmitting(false);
    }
  }

  const statusColor = (s: string) => s === "paid" ? "text-primary" : s === "missed" ? "text-accent" : "text-muted";

  return (
    <div class="mt-3 border-t border-surface-hover pt-3 space-y-2">
      <div class="flex items-center justify-between mb-1">
        <span class="text-[12px] font-body font-medium text-muted uppercase tracking-wide">Payments</span>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          class="text-[12px] text-primary font-medium hover:underline"
        >
          {showForm() ? "Cancel" : "+ Add"}
        </button>
      </div>
      <Show when={showForm()}>
        <form onSubmit={handleAdd} class="flex flex-wrap gap-2 items-end bg-bg rounded-input p-2">
          <input
            type="number"
            placeholder="Amount"
            step="0.01"
            required
            value={payAmount()}
            onInput={(e) => setPayAmount(e.currentTarget.value)}
            class="text-sm border border-surface-hover rounded-input px-2 py-1 bg-bg text-text w-28"
          />
          <input
            type="date"
            value={payDate()}
            onInput={(e) => setPayDate(e.currentTarget.value)}
            class="text-sm border border-surface-hover rounded-input px-2 py-1 bg-bg text-text"
          />
          <select
            value={payStatus()}
            onChange={(e) => setPayStatus(e.currentTarget.value)}
            class="text-sm border border-surface-hover rounded-input px-2 py-1 bg-bg text-text"
          >
            <option value="paid">Paid</option>
            <option value="due">Due</option>
            <option value="missed">Missed</option>
          </select>
          <button
            type="submit"
            disabled={submitting()}
            class="text-sm px-3 py-1 rounded-input bg-primary text-bg font-medium hover:opacity-90 disabled:opacity-50"
          >
            {submitting() ? "…" : "Record"}
          </button>
        </form>
      </Show>
      <Show when={payments.loading}>
        <p class="text-xs text-muted">Loading…</p>
      </Show>
      <Show when={!payments.loading && (payments() ?? []).length === 0}>
        <p class="text-xs text-muted">No payments recorded.</p>
      </Show>
      <For each={payments() ?? []}>
        {(p) => (
          <div class="flex items-center justify-between text-sm py-1">
            <div class="flex items-center gap-2">
              <span class={`text-xs font-medium capitalize ${statusColor(p.status)}`}>{p.status}</span>
              <span class="text-muted text-xs">{p.date}</span>
            </div>
            <span class="font-mono text-text">{formatCurrency(numericToFloat(p.amount), props.currency)}</span>
          </div>
        )}
      </For>
    </div>
  );
}

export default function Insurance() {
  const [policies, { refetch }] = createResource(() => api.get<Policy[]>("/v1/insurance"));
  const [sheetOpen, setSheetOpen] = createSignal(false);
  const [editPolicy, setEditPolicy] = createSignal<FullPolicy | null>(null);
  const [editSheetOpen, setEditSheetOpen] = createSignal(false);
  const [expandedId, setExpandedId] = createSignal<string | null>(null);

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

  function toggleExpand(id: string) {
    setExpandedId((cur) => cur === id ? null : id);
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
              const isExpanded = () => expandedId() === p.id;
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
                        <button
                          type="button"
                          onClick={() => toggleExpand(p.id)}
                          class="mt-2 flex items-center gap-1 text-xs text-muted hover:text-text transition-colors"
                        >
                          {isExpanded() ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          {isExpanded() ? "Hide payments" : "View payments"}
                        </button>
                        <Show when={isExpanded()}>
                          <InsurancePayments policyId={p.id} currency={p.currency} />
                        </Show>
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
                start_date: p().start_date,
                nominee: p().nominee,
                notes: p().notes,
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
