import { createResource, createSignal, For, Show } from "solid-js";
import { Landmark } from "lucide-solid";
import { api } from "../lib/api";
import { formatCurrency, numericToFloat, pgDateToString } from "../lib/format";
import { cn } from "../lib/utils";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { SkeletonBlock } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";
import { Sheet } from "../components/ui/sheet";
import { Eyebrow } from "../components/ui/eyebrow";
import { Money } from "../components/ui/money";
import { ProgressBar } from "../components/ui/progress-bar";
import { LoanForm } from "../components/forms/loan-form";
import { WealthTabs } from "../components/wealth/WealthTabs";
import { AddButton, DisclosureButton, Figure, RowActions, inlineField, paymentTone, shortDate } from "../components/wealth/common";
import { nextDebit } from "../components/wealth/sip";

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

interface AmortizationRow {
  installment: number;
  payment_date: string;
  emi: number;
  principal_component: number;
  interest_component: number;
  remaining_balance: number;
}

interface AmortizationData {
  loan_id: string;
  loan_name: string;
  emi: number;
  total_payment: number;
  total_interest: number;
  schedule: AmortizationRow[];
}

function LoanPayments(props: { loanId: string; currency: string; id: string }) {
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
        <form onSubmit={handleAdd} class="grid grid-cols-2 md:grid-cols-3 gap-2" aria-label="Record loan payment">
          <input aria-label="Amount" type="number" placeholder="Amount" step="0.01" required value={payAmount()}
            onInput={(e) => setPayAmount(e.currentTarget.value)} class={cn(inlineField, "font-mono tabular")} />
          <input aria-label="Date" type="date" value={payDate()} onInput={(e) => setPayDate(e.currentTarget.value)} class={cn(inlineField, "font-mono tabular")} />
          <select aria-label="Status" value={payStatus()} onChange={(e) => setPayStatus(e.currentTarget.value)} class={inlineField}>
            <option value="paid">Paid</option>
            <option value="scheduled">Scheduled</option>
            <option value="missed">Missed</option>
            <option value="partial">Partial</option>
          </select>
          <input aria-label="Principal component" type="number" placeholder="Principal" step="0.01" value={payPrincipal()}
            onInput={(e) => setPayPrincipal(e.currentTarget.value)} class={cn(inlineField, "font-mono tabular")} />
          <input aria-label="Interest component" type="number" placeholder="Interest" step="0.01" value={payInterest()}
            onInput={(e) => setPayInterest(e.currentTarget.value)} class={cn(inlineField, "font-mono tabular")} />
          <button
            type="submit"
            disabled={submitting()}
            class="col-span-2 md:col-span-1 h-9 rounded-[10px] bg-btn text-btn-text text-[13.5px] font-semibold hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
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

function AmortizationSchedule(props: { loanId: string; currency: string; id: string }) {
  const [data] = createResource(
    () => props.loanId,
    (id) =>
      api
        .get<AmortizationData>(`/v1/loans/${id}/amortization`)
        .catch(() => null)
  );

  const today = new Date();
  const todayYM = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  const isCurrentMonth = (dateStr: string) => dateStr.slice(0, 7) === todayYM;

  return (
    <div id={props.id} class="mt-2 rounded-[14px] bg-sunken p-3">
      <Eyebrow as="h3">Amortization schedule</Eyebrow>

      <Show when={data.loading}>
        <p class="text-[12.5px] text-muted mt-2">Loading…</p>
      </Show>

      <Show when={!data.loading && data() === null}>
        <p class="text-[12.5px] text-muted mt-2 text-pretty">
          Schedule unavailable. Add the outstanding balance and term to see projections.
        </p>
      </Show>

      <Show when={data()}>
        {(d) => (
          <>
            <div class="grid grid-cols-3 gap-2 mt-3 mb-3">
              <Figure label="EMI"><Money value={d().emi} currency={props.currency} class="text-[13.5px]" /></Figure>
              <Figure label="Total paid"><Money value={d().total_payment} currency={props.currency} class="text-[13.5px]" /></Figure>
              <Figure label="Interest"><Money value={d().total_interest} currency={props.currency} class="text-[13.5px]" /></Figure>
            </div>
            <div class="overflow-auto max-h-[300px] rounded-[10px] border border-border">
              <table class="w-full text-[12px] border-collapse font-mono tabular">
                <caption class="sr-only">Amortization schedule</caption>
                <thead class="sticky top-0 bg-surface z-10">
                  <tr class="text-muted">
                    <th scope="col" class="text-left px-2 py-2 font-medium">#</th>
                    <th scope="col" class="text-left px-2 py-2 font-medium">Date</th>
                    <th scope="col" class="text-right px-2 py-2 font-medium">EMI</th>
                    <th scope="col" class="text-right px-2 py-2 font-medium">Principal</th>
                    <th scope="col" class="text-right px-2 py-2 font-medium">Interest</th>
                    <th scope="col" class="text-right px-2 py-2 font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={d().schedule}>
                    {(row) => (
                      <tr
                        class={cn("border-t border-border", isCurrentMonth(row.payment_date) ? "bg-signal-soft" : "hover:bg-raised")}
                        aria-current={isCurrentMonth(row.payment_date) ? "date" : undefined}
                      >
                        <td class="px-2 py-1.5 text-muted">{row.installment}</td>
                        <td class="px-2 py-1.5 text-text whitespace-nowrap">{row.payment_date}</td>
                        <td class="px-2 py-1.5 text-right text-text whitespace-nowrap">{formatCurrency(row.emi, props.currency)}</td>
                        <td class="px-2 py-1.5 text-right text-text whitespace-nowrap">{formatCurrency(row.principal_component, props.currency)}</td>
                        <td class="px-2 py-1.5 text-right text-muted whitespace-nowrap">{formatCurrency(row.interest_component, props.currency)}</td>
                        <td class="px-2 py-1.5 text-right text-text whitespace-nowrap">{formatCurrency(row.remaining_balance, props.currency)}</td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </>
        )}
      </Show>
    </div>
  );
}

export default function Loans() {
  const [loans, { refetch }] = createResource(() => api.get<Loan[]>("/v1/loans"));
  const [sheetOpen, setSheetOpen] = createSignal(false);
  const [editLoan, setEditLoan] = createSignal<Loan | null>(null);
  const [editSheetOpen, setEditSheetOpen] = createSignal(false);
  const [expandedId, setExpandedId] = createSignal<string | null>(null);
  const [amortizationId, setAmortizationId] = createSignal<string | null>(null);

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

  function toggleAmortization(id: string) {
    setAmortizationId((cur) => cur === id ? null : id);
  }

  const totals = () => {
    const list = loans() ?? [];
    return {
      outstanding: list.reduce((n, l) => n + numericToFloat(l.outstanding_balance), 0),
      emi: list.reduce((n, l) => n + (numericToFloat(l.outstanding_balance) > 0 ? numericToFloat(l.emi_amount) : 0), 0),
    };
  };

  return (
    <>
      <PageHeader title="Loans" actions={<AddButton label="Add loan" onClick={() => setSheetOpen(true)} />} />
      <div class="px-5 md:px-7 py-5 md:py-6 flex flex-col gap-4">
        <WealthTabs />

        <Show when={(loans() ?? []).length > 0}>
          <div class="grid grid-cols-2 gap-4">
            <BentoBlock class="flex flex-col gap-2">
              <Eyebrow>Outstanding</Eyebrow>
              <Money value={-totals().outstanding} tone={totals().outstanding > 0 ? "neg" : "text"} class="text-[24px] md:text-[30px] leading-none tracking-[-0.04em]" />
            </BentoBlock>
            <BentoBlock class="flex flex-col gap-2">
              <Eyebrow>EMIs per month</Eyebrow>
              <Money value={totals().emi} mutedSymbol class="text-[24px] md:text-[30px] leading-none tracking-[-0.04em]" />
            </BentoBlock>
          </div>
        </Show>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <Show when={loans.loading}>
            <SkeletonBlock class="min-h-[160px]" />
            <SkeletonBlock class="min-h-[160px]" />
          </Show>
          <Show when={loans.error}>
            <p class="md:col-span-2 text-neg text-[14px] py-6 text-center">Failed to load loans.</p>
          </Show>
          <Show when={!loans.loading && !loans.error && (loans() ?? []).length === 0}>
            <div class="md:col-span-2">
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
              const principal = numericToFloat(l.principal);
              const outstanding = numericToFloat(l.outstanding_balance);
              const repaid = principal > 0 ? Math.max(0, Math.min(100, ((principal - outstanding) / principal) * 100)) : 0;
              const nextEmi = outstanding > 0 ? nextDebit(l.start_date) : null;
              const started = pgDateToString(l.start_date);
              const isExpanded = () => expandedId() === l.id;
              const isAmortizationOpen = () => amortizationId() === l.id;
              return (
                <BentoBlock class="group flex flex-col gap-4">
                  <div class="flex items-start gap-3">
                    <div class="w-[38px] h-[38px] rounded-[10px] bg-raised flex items-center justify-center text-muted shrink-0">
                      <Landmark size={18} />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="text-[15px] font-medium text-text truncate">{l.name}</div>
                      <div class="font-mono text-[11px] text-muted mt-1 tabular">
                        <span class="uppercase tracking-[0.08em]">{l.loan_type.replace("_", " ")}</span>
                        <Show when={rate > 0}> · {rate.toFixed(2)}%</Show>
                        <Show when={l.tenure_months > 0}> · {l.tenure_months} mo</Show>
                      </div>
                    </div>
                    <RowActions name={l.name} onEdit={() => { setEditLoan(l); setEditSheetOpen(true); }} onDelete={() => handleDelete(l.id, l.name)} class="-mr-2 -mt-1" />
                  </div>

                  <div class="grid grid-cols-3 gap-3">
                    <Figure label="Outstanding">
                      <Money value={outstanding} currency={l.currency} tone={outstanding > 0 ? "neg" : "text"} />
                    </Figure>
                    <Figure label="EMI" sub={computed > 0 ? `calc ${formatCurrency(computed, l.currency)}` : undefined}>
                      <Money value={numericToFloat(l.emi_amount)} currency={l.currency} />
                    </Figure>
                    <Figure label="Principal"><Money value={principal} currency={l.currency} /></Figure>
                  </div>

                  <Show when={principal > 0}>
                    <div class="flex flex-col gap-1.5">
                      <ProgressBar pct={repaid} tone="bg-pos" label={`${l.name} repaid`} />
                      <div class="flex justify-between font-mono tabular text-[11.5px] text-muted">
                        <span>{Math.round(repaid)}% repaid</span>
                        <Show when={nextEmi} fallback={<span>{started ? `since ${shortDate(started)}` : ""}</span>}>
                          <span>next EMI <span class="text-text">{shortDate(nextEmi!)}</span></span>
                        </Show>
                      </div>
                    </div>
                  </Show>

                  <div class="flex items-center gap-3 border-t border-border pt-2 -mb-1">
                    <DisclosureButton open={isExpanded()} controls={`loan-pay-${l.id}`} onClick={() => toggleExpand(l.id)}>
                      Payments
                    </DisclosureButton>
                    <DisclosureButton open={isAmortizationOpen()} controls={`loan-amort-${l.id}`} onClick={() => toggleAmortization(l.id)}>
                      Schedule
                    </DisclosureButton>
                  </div>
                  <Show when={isExpanded()}>
                    <LoanPayments id={`loan-pay-${l.id}`} loanId={l.id} currency={l.currency} />
                  </Show>
                  <Show when={isAmortizationOpen()}>
                    <AmortizationSchedule id={`loan-amort-${l.id}`} loanId={l.id} currency={l.currency} />
                  </Show>
                </BentoBlock>
              );
            }}
          </For>
        </div>
      </div>

      <Sheet open={sheetOpen()} onClose={() => setSheetOpen(false)} title="Add loan">
        <LoanForm onSuccess={handleSuccess} onClose={() => setSheetOpen(false)} />
      </Sheet>

      <Sheet open={editSheetOpen()} onClose={closeEdit} title="Edit loan">
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
