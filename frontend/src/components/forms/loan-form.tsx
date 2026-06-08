import { createSignal, createMemo, createEffect, Show } from "solid-js";
import { api } from "../../lib/api";
import { numericToFloat, pgDateToString } from "../../lib/format";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Button } from "../ui/button";

type LoanFormProps = {
  onSuccess: () => void;
  onClose: () => void;
  existing?: {
    id: string;
    name: string;
    loan_type: string;
    currency: string;
    principal: unknown;
    interest_rate: unknown;
    term_months: number;
    emi_amount: unknown;
    outstanding_balance: unknown;
    start_date: unknown;
  };
};

export function LoanForm(props: LoanFormProps) {
  const [name, setName] = createSignal(props.existing?.name ?? "");
  const [loanType, setLoanType] = createSignal(props.existing?.loan_type ?? "home");
  const [currency, setCurrency] = createSignal(props.existing?.currency ?? "INR");
  const [principal, setPrincipal] = createSignal(
    numericToFloat(props.existing?.principal)?.toString() ?? ""
  );
  const [interestRate, setInterestRate] = createSignal(
    numericToFloat(props.existing?.interest_rate)?.toString() ?? ""
  );
  const [termMonths, setTermMonths] = createSignal(
    props.existing?.term_months?.toString() ?? "12"
  );
  const [emiAmount, setEmiAmount] = createSignal(
    numericToFloat(props.existing?.emi_amount)?.toString() ?? ""
  );
  const [outstandingBalance, setOutstandingBalance] = createSignal(
    numericToFloat(props.existing?.outstanding_balance)?.toString() ?? ""
  );
  const [startDate, setStartDate] = createSignal(pgDateToString(props.existing?.start_date) ?? "");

  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal("");

  const computedEmi = createMemo(() => {
    const P = parseFloat(principal());
    const rPct = parseFloat(interestRate());
    const n = parseInt(termMonths(), 10);
    if (isNaN(P) || isNaN(rPct) || isNaN(n) || n < 1) return "";
    const r = (rPct / 100) / 12;
    if (r === 0) return (P / n).toFixed(2);
    const pow = Math.pow(1 + r, n);
    return ((P * r * pow) / (pow - 1)).toFixed(2);
  });

  // On first run with an existing loan, leave emi_amount at the user-supplied
  // value; only recompute it on subsequent user-driven changes.
  let firstRun = true;
  createEffect(() => {
    const v = computedEmi();
    if (!v) return;
    if (firstRun) { firstRun = false; return; }
    setEmiAmount(v);
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError("");

    if (!name().trim()) {
      setError("Name is required.");
      return;
    }

    const term = parseInt(termMonths(), 10);
    if (isNaN(term) || term < 1) {
      setError("Term (months) must be at least 1.");
      return;
    }

    const principalVal = parseFloat(principal());

    setSubmitting(true);
    try {
      const body = {
        name: name().trim(),
        loan_type: loanType(),
        currency: currency(),
        term_months: term,
        ...(principal() !== "" ? { principal: principalVal } : {}),
        ...(interestRate() !== "" ? { interest_rate: parseFloat(interestRate()) } : {}),
        ...(emiAmount() !== "" ? { emi_amount: parseFloat(emiAmount()) } : {}),
        ...(outstandingBalance() !== "" ? { outstanding_balance: parseFloat(outstandingBalance()) } : {}),
        ...(startDate() ? { start_date: startDate() } : {}),
      };
      if (props.existing) {
        await api.put(`/v1/loans/${props.existing.id}`, body);
      } else {
        await api.post("/v1/loans", body);
      }
      props.onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save loan.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} class="flex flex-col gap-4">
      {/* Name */}
      <div>
        <label for="loan-name" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
          Name
        </label>
        <Input
          id="loan-name"
          type="text"
          placeholder="e.g. HDFC Home Loan"
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
          required
        />
      </div>

      {/* Loan Type */}
      <div>
        <label for="loan-type" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
          Loan Type
        </label>
        <Select
          id="loan-type"
          value={loanType()}
          onChange={(e) => setLoanType(e.currentTarget.value)}
          required
        >
          <option value="home">Home</option>
          <option value="personal">Personal</option>
          <option value="vehicle">Vehicle</option>
          <option value="education">Education</option>
          <option value="other">Other</option>
        </Select>
      </div>

      {/* Currency */}
      <div>
        <label for="loan-currency" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
          Currency
        </label>
        <Select
          id="loan-currency"
          value={currency()}
          onChange={(e) => setCurrency(e.currentTarget.value)}
          required
        >
          <option value="INR">INR</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
        </Select>
      </div>

      {/* Principal */}
      <div>
        <label for="loan-principal" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
          Principal
        </label>
        <Input
          id="loan-principal"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={principal()}
          onInput={(e) => setPrincipal(e.currentTarget.value)}
        />
      </div>

      {/* Interest Rate */}
      <div>
        <label for="loan-interest-rate" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
          Interest Rate (%)
        </label>
        <Input
          id="loan-interest-rate"
          type="number"
          min="0"
          step="0.01"
          placeholder="8.5"
          value={interestRate()}
          onInput={(e) => setInterestRate(e.currentTarget.value)}
        />
      </div>

      {/* Term Months */}
      <div>
        <label for="loan-term-months" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
          Term (months)
        </label>
        <Input
          id="loan-term-months"
          type="number"
          min="1"
          step="1"
          value={termMonths()}
          onInput={(e) => setTermMonths(e.currentTarget.value)}
          required
        />
      </div>

      {/* EMI Amount */}
      <div>
        <label for="loan-emi-amount" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
          EMI Amount
        </label>
        <Input
          id="loan-emi-amount"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={emiAmount()}
          onInput={(e) => setEmiAmount(e.currentTarget.value)}
        />
      </div>

      {/* Outstanding Balance */}
      <div>
        <label for="loan-outstanding-balance" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
          Outstanding Balance
        </label>
        <Input
          id="loan-outstanding-balance"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={outstandingBalance()}
          onInput={(e) => setOutstandingBalance(e.currentTarget.value)}
        />
      </div>

      {/* Start Date */}
      <div>
        <label for="loan-start-date" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
          Start Date
        </label>
        <Input
          id="loan-start-date"
          type="date"
          value={startDate()}
          onInput={(e) => setStartDate(e.currentTarget.value)}
        />
      </div>

      <Show when={error()}>
        <p class="text-accent text-sm">{error()}</p>
      </Show>

      <Button type="submit" class="w-full mt-2" disabled={submitting()}>
        {submitting() ? "Saving…" : props.existing ? "Save Changes" : "Save"}
      </Button>
    </form>
  );
}
