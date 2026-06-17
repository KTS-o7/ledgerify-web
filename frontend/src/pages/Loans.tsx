import { createResource, createSignal, For, Show } from "solid-js";
import { Plus, Landmark, Calendar, TrendingDown, Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-solid";
import { api } from "../lib/api";
import { formatCurrency, numericToFloat } from "../lib/format";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { Badge } from "../components/ui/badge";
import { SkeletonBlock } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";
import { Sheet } from "../components/ui/sheet";
import { LoanForm } from "../components/forms/loan-form";

interface Loan {
  id: string;
  name: string;
  loan_type: string;
  principal: unknown;           // pgtype.Numeric
  emi_amount: unknown;          // pgtype.Numeric
  outstanding_balance: unknown; // pgtype.Numeric
  currency: string;
  start_date: unknown;          // pgtype.Date
  tenure_months: number;
  interest_rate: unknown;       // pgtype.Numeric
  computed_emi: unknown;        // pgtype.Numeric
}

interface LoanPayment {
  id: string;
  date: string;
  amount: unknown;
  principal_component: unknown;
  interest_component: unknown;
  status: string;
}

function LoanPayments(props: { loanId: string; currency: string }) {
  const [payments, { refetch }] = createResource(
    () => props.loanId,
    (id) => api.get<LoanPayment[]>(`/v1/loans/${id}/payments`).catch(() => [] as LoanPayment[])
  );
  const [showForm, setShowForm] = createSignal(false);
  const [payAmount, setPayAmount] = createSignal("");
  const [payDate, setPayDate] = createSignal(new Date().toISOString().slice(0, 10));
  const [payStatus, setPayStatus] = createSignal("paid");
  const [payPrincipal, setPayPrincipal] = createSignal("");
  const [payInterest, setPayInterest] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);

  async function handleAdd(e: SubmitEvent) {
    e.preventDefault();
    if (!payAmount() || !payDate()) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        amount: parseFloat(payAmount()),
        date: payDate(),
        status: payStatus(),
        ...(payPrincipal() ? { principal_component: parseFloat(payPrincipal()) } : {}),
        ...(payInterest() ? { interest_component: parseFloat(payInterest()) } : {}),
      };
      await api.post(`/v1/loans/${props.loanId}/payments`, body);
      setPayAmount("");
      setPayPrincipal("");
      setPayInterest("");
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
            <option value="scheduled">Scheduled</option>
            <option value="missed">Missed</option>
            <option value="partial">Partial</option>
          </select>
          <input
            type="number"
            placeholder="Principal component"
            step="0.01"
            value={payPrincipal()}
            onInput={(e) => setPayPrincipal(e.currentTarget.value)}
            class="text-sm border border-surface-hover rounded-input px-2 py-1 bg-bg text-text w-32"
          />
          <input
            type="number"
            placeholder="Interest component"
            step="0.01"
            value={payInterest()}
            onInput={(e) => setPayInterest(e.currentTarget.value)}
            class="text-sm border border-surface-hover rounded-input px-2 py-1 bg-bg text-text w-32"
          />
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

export default function Loans() {
  const [loans, { refetch }] = createResource(() => api.get<Loan[]>("/v1/loans"));
  const [sheetOpen, setSheetOpen] = createSignal(false);
  const [editLoan, setEditLoan] = createSignal<Loan | null>(null);
  const [editSheetOpen, setEditSheetOpen] = createSignal(false);
  const [expandedId, setExpandedId] = createSignal<string | null>(null);

  function handleSuccess() {
    setSheetOpen(false);
    refetch();
  }
  function closeEdit() {
    setEditSheetOpen(false);
    setEditLoan(null);
  }
  function handleEditSuccess() {
    closeEdit();
    refetch();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await api.delete(`/v1/loans/${id}`);
      refetch();
    } catch {
      alert("Failed to delete loan.");
    }
  }

  function toggleExpand(id: string) {
    setExpandedId((cur) => cur === id ? null : id);
  }

  return (
    <>
      <PageHeader title="Loans" actions={
        <button
          type="button"
          aria-label="Add loan"
          onClick={() => setSheetOpen(true)}
          class="w-10 h-10 flex items-center justify-center rounded-full bg-surface text-text active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <Plus size={20} />
        </button>
      } />
      <div class="p-4 md:p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <Show when={loans.loading}>
            <SkeletonBlock class="min-h-[140px]" />
            <SkeletonBlock class="min-h-[140px]" />
          </Show>
          <Show when={loans.error}>
            <div class="col-span-1 md:col-span-2 lg:col-span-3">
              <p class="text-accent text-sm py-6 text-center">Failed to load loans.</p>
            </div>
          </Show>
          <Show when={!loans.loading && !loans.error && (loans() ?? []).length === 0}>
            <div class="col-span-1 md:col-span-2 lg:col-span-3">
              <EmptyState
                icon={Landmark}
                title="No loans tracked"
                body="Track outstanding loans and EMI schedules."
                action={{ label: "Add loan", onClick: () => setSheetOpen(true) }}
              />
            </div>
          </Show>
          <For each={loans() ?? []}>
            {(l) => {
              const rate = numericToFloat(l.interest_rate);
              const computed = numericToFloat(l.computed_emi);
              const isExpanded = () => expandedId() === l.id;
              return (
                <div class="group relative">
                  <BentoBlock variant="pressable">
                    <div class="flex items-start gap-3">
                      <div class="w-10 h-10 rounded-input bg-bg flex items-center justify-center text-muted flex-shrink-0">
                        <Landmark size={20} />
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                          <span class="font-display text-lg font-bold text-text truncate">{l.name}</span>
                          <Badge variant="outline">{l.loan_type.replace("_", " ")}</Badge>
                          <Show when={rate > 0}>
                            <Badge variant="outline" class="font-mono">{rate.toFixed(2)}%</Badge>
                          </Show>
                        </div>
                        <div class="grid grid-cols-3 gap-2 mt-2">
                          <div>
                            <div class="flex items-center gap-1 text-[12px] text-muted uppercase tracking-wide"><TrendingDown size={12} /> Principal</div>
                            <div class="font-display text-sm font-semibold text-text">{formatCurrency(numericToFloat(l.principal), l.currency)}</div>
                          </div>
                          <div>
                            <div class="text-[12px] text-muted uppercase tracking-wide">EMI</div>
                            <div class="font-display text-sm font-semibold text-text">{formatCurrency(numericToFloat(l.emi_amount), l.currency)}</div>
                            <Show when={computed > 0}>
                              <div class="font-mono text-[11px] text-muted">computed: {formatCurrency(computed, l.currency)}</div>
                            </Show>
                          </div>
                          <div>
                            <div class="flex items-center gap-1 text-[12px] text-muted uppercase tracking-wide"><Calendar size={12} /> Outstanding</div>
                            <div class="font-display text-sm font-semibold text-text">{formatCurrency(numericToFloat(l.outstanding_balance), l.currency)}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleExpand(l.id)}
                          class="mt-2 flex items-center gap-1 text-xs text-muted hover:text-text transition-colors"
                        >
                          {isExpanded() ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          {isExpanded() ? "Hide payments" : "View payments"}
                        </button>
                        <Show when={isExpanded()}>
                          <LoanPayments loanId={l.id} currency={l.currency} />
                        </Show>
                      </div>
                    </div>
                  </BentoBlock>
                  <div class="absolute top-3 right-3 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setEditLoan(l); setEditSheetOpen(true); }}
                      aria-label={`Edit ${l.name}`}
                      class="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-hover text-muted hover:text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDelete(l.id, l.name); }}
                      aria-label={`Delete ${l.name}`}
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

      <Sheet open={sheetOpen()} onClose={() => setSheetOpen(false)} title="Add Loan">
        <LoanForm onSuccess={handleSuccess} onClose={() => setSheetOpen(false)} />
      </Sheet>

      <Sheet open={editSheetOpen()} onClose={closeEdit} title="Edit Loan">
        <Show when={editLoan()}>
          {(l) => (
            <LoanForm
              existing={{
                id: l().id,
                name: l().name,
                loan_type: l().loan_type,
                currency: l().currency,
                principal: l().principal,
                interest_rate: l().interest_rate,
                term_months: l().tenure_months,
                emi_amount: l().emi_amount,
                outstanding_balance: l().outstanding_balance,
                start_date: l().start_date,
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
