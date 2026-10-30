import { createResource, createSignal, For, Show } from "solid-js";
import { ShieldCheck } from "lucide-solid";
import { api } from "../lib/api";
import { numericToFloat, pgTextToString, pgDateToString } from "../lib/format";
import { cn } from "../lib/utils";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { Badge } from "../components/ui/badge";
import { SkeletonBlock } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";
import { Sheet } from "../components/ui/sheet";
import { Eyebrow } from "../components/ui/eyebrow";
import { Money } from "../components/ui/money";
import { InsuranceForm } from "../components/forms/insurance-form";
import { AddButton, DisclosureButton, Figure, RowActions, inlineField, paymentTone, shortDate } from "../components/wealth/common";

const PER_YEAR: Record<string, number> = { monthly: 12, quarterly: 4, semi_annual: 2, half_yearly: 2, annual: 1, yearly: 1 };
const FREQ_SHORT: Record<string, string> = { monthly: "/mo", quarterly: "/qtr", annual: "/yr", yearly: "/yr", semi_annual: "/half", half_yearly: "/half" };

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

function InsurancePayments(props: { policyId: string; currency: string; id: string }) {
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

  return (
    <div id={props.id} class="mt-2 rounded-[14px] bg-sunken p-3 flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <Eyebrow as="h3">Payments</Eyebrow>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          aria-expanded={showForm()}
          class="text-[12.5px] text-signal font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal rounded"
        >
          {showForm() ? "Cancel" : "Record payment"}
        </button>
      </div>
      <Show when={showForm()}>
        <form onSubmit={handleAdd} class="grid grid-cols-2 md:grid-cols-4 gap-2" aria-label="Record premium payment">
          <input aria-label="Amount" type="number" placeholder="Amount" step="0.01" required value={payAmount()}
            onInput={(e) => setPayAmount(e.currentTarget.value)} class={cn(inlineField, "font-mono tabular")} />
          <input aria-label="Date" type="date" value={payDate()} onInput={(e) => setPayDate(e.currentTarget.value)} class={cn(inlineField, "font-mono tabular")} />
          <select aria-label="Status" value={payStatus()} onChange={(e) => setPayStatus(e.currentTarget.value)} class={inlineField}>
            <option value="paid">Paid</option>
            <option value="due">Due</option>
            <option value="missed">Missed</option>
          </select>
          <button
            type="submit"
            disabled={submitting()}
            class="h-9 rounded-[10px] bg-btn text-btn-text text-[13.5px] font-semibold hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            {submitting() ? "Saving…" : "Record"}
          </button>
        </form>
      </Show>
      <Show when={payments.loading}>
        <p class="text-[12.5px] text-muted">Loading…</p>
      </Show>
      <Show when={!payments.loading && (payments() ?? []).length === 0}>
        <p class="text-[12.5px] text-muted">No payments recorded.</p>
      </Show>
      <ul class="flex flex-col">
        <For each={payments() ?? []}>
          {(p) => (
            <li class="flex items-center justify-between gap-2 h-9 text-[13px]">
              <div class="flex items-center gap-2.5">
                <span class={cn("font-mono text-[10.5px] uppercase tracking-[0.08em] w-16", paymentTone(p.status))}>{p.status}</span>
                <span class="font-mono tabular text-[12px] text-muted">{shortDate(p.date)}</span>
              </div>
              <Money value={numericToFloat(p.amount)} currency={props.currency} />
            </li>
          )}
        </For>
      </ul>
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

  const totals = () => {
    const list = policies() ?? [];
    return {
      yearly: list.reduce((n, p) => n + numericToFloat(p.premium_amount) * (PER_YEAR[p.premium_frequency] ?? 1), 0),
      dueSoon: list.filter((p) => renewalStatus(p) === "expiring").length,
    };
  };

  return (
    <>
      <PageHeader title="Insurance" actions={<AddButton label="Add policy" onClick={() => setSheetOpen(true)} />} />
      <div class="px-5 md:px-7 py-5 md:py-6 flex flex-col gap-4">
        <Show when={(policies() ?? []).length > 0}>
          <div class="grid grid-cols-2 gap-4">
            <BentoBlock class="flex flex-col gap-2">
              <Eyebrow>Premiums per year</Eyebrow>
              <Money value={totals().yearly} mutedSymbol class="text-[24px] md:text-[30px] leading-none tracking-[-0.04em]" />
            </BentoBlock>
            <BentoBlock class="flex flex-col gap-2">
              <Eyebrow>Renewing in 30 days</Eyebrow>
              <span class={cn("font-mono tabular text-[24px] md:text-[30px] leading-none tracking-[-0.04em]", totals().dueSoon > 0 ? "text-warn" : "text-text")}>
                {totals().dueSoon}
              </span>
            </BentoBlock>
          </div>
        </Show>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <Show when={policies.loading}>
            <SkeletonBlock class="min-h-[150px]" />
            <SkeletonBlock class="min-h-[150px]" />
          </Show>
          <Show when={policies.error}>
            <p class="md:col-span-2 text-neg text-[14px] py-6 text-center">Failed to load policies.</p>
          </Show>
          <Show when={!policies.loading && !policies.error && (policies() ?? []).length === 0}>
            <div class="md:col-span-2">
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
                <BentoBlock class="group flex flex-col gap-4">
                  <div class="flex items-start gap-3">
                    <div class="w-[38px] h-[38px] rounded-[10px] bg-raised flex items-center justify-center text-muted shrink-0">
                      <ShieldCheck size={18} />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="text-[15px] font-medium text-text truncate">{p.name}</div>
                      <div class="text-[12.5px] text-muted mt-0.5 truncate">
                        <span class="capitalize">{p.policy_type.replace("_", " ")}</span>
                        <Show when={provider}> · {provider}</Show>
                      </div>
                    </div>
                    <Badge variant={status === "active" ? "default" : status === "expiring" ? "warning" : "destructive"} class="shrink-0">
                      {status === "active" ? "Active" : status === "expiring" ? "Renews soon" : "Expired"}
                    </Badge>
                    <RowActions name={p.name} onEdit={() => openEdit(p.id)} onDelete={() => handleDelete(p.id, p.name)} class="-mr-2 -mt-1" />
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <Figure label="Premium">
                      <Money value={numericToFloat(p.premium_amount)} currency={p.currency} />
                      <span class="text-muted text-[12px]">{FREQ_SHORT[p.premium_frequency] ?? ""}</span>
                    </Figure>
                    <Figure label="Renews">
                      <span class={status === "expiring" ? "text-warn" : status === "expired" ? "text-neg" : undefined}>
                        {renewalDate ? shortDate(renewalDate) : "—"}
                      </span>
                    </Figure>
                  </div>
                  <div class="border-t border-border pt-2 -mb-1">
                    <DisclosureButton open={isExpanded()} controls={`ins-pay-${p.id}`} onClick={() => toggleExpand(p.id)}>
                      Payments
                    </DisclosureButton>
                  </div>
                  <Show when={isExpanded()}>
                    <InsurancePayments id={`ins-pay-${p.id}`} policyId={p.id} currency={p.currency} />
                  </Show>
                </BentoBlock>
              );
            }}
          </For>
        </div>
      </div>

      <Sheet open={sheetOpen()} onClose={() => setSheetOpen(false)} title="Add policy">
        <InsuranceForm onSuccess={handleSuccess} onClose={() => setSheetOpen(false)} />
      </Sheet>

      <Sheet open={editSheetOpen()} onClose={closeEdit} title="Edit policy">
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
