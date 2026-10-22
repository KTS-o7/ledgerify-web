import { createSignal, Show } from "solid-js";
import { api } from "../../lib/api";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Button } from "../ui/button";

type AccountFormProps = {
  onSuccess: () => void;
  onClose: () => void;
  existing?: {
    id: string;
    name: string;
    type: string;
    currency: string;
    credit_limit?: number | null;
    statement_day?: number | null;
    payment_due_day?: number | null;
  };
};

const labelClass = "text-[12.5px] font-medium text-muted mb-1.5 block";

export function AccountForm(props: AccountFormProps) {
  const [name, setName] = createSignal(props.existing?.name ?? "");
  const [type, setType] = createSignal(props.existing?.type ?? "bank");
  const [currency, setCurrency] = createSignal(props.existing?.currency ?? "INR");
  const [openingBalance, setOpeningBalance] = createSignal("");
  const [creditLimit, setCreditLimit] = createSignal(
    props.existing?.credit_limit != null ? String(props.existing.credit_limit) : ""
  );
  const [statementDay, setStatementDay] = createSignal(
    props.existing?.statement_day != null ? String(props.existing.statement_day) : ""
  );
  const [paymentDueDay, setPaymentDueDay] = createSignal(
    props.existing?.payment_due_day != null ? String(props.existing.payment_due_day) : ""
  );
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal("");

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    setError("");

    if (!name().trim()) {
      setError("Name is required.");
      return;
    }

    setSubmitting(true);
    try {
      const creditCardFields: Record<string, unknown> = {};
      if (type() === "credit_card") {
        if (creditLimit() !== "") creditCardFields.credit_limit = parseFloat(creditLimit());
        if (statementDay() !== "") creditCardFields.statement_day = parseFloat(statementDay());
        if (paymentDueDay() !== "") creditCardFields.payment_due_day = parseFloat(paymentDueDay());
      }

      if (props.existing) {
        await api.put(`/v1/accounts/${props.existing.id}`, {
          name: name().trim(),
          type: type(),
          currency: currency(),
          ...creditCardFields,
        });
      } else {
        const body: Record<string, unknown> = {
          name: name().trim(),
          type: type(),
          currency: currency(),
          ...creditCardFields,
        };
        const bal = openingBalance().trim();
        if (bal !== "") {
          body.opening_balance = parseFloat(bal);
        }
        await api.post("/v1/accounts", body);
      }
      props.onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} class="flex flex-col gap-4">
      <div>
        <label for="account-name" class={labelClass}>
          Name
        </label>
        <Input
          id="account-name"
          type="text"
          placeholder="e.g. HDFC Savings"
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
          required
        />
      </div>

      <div>
        <label for="account-type" class={labelClass}>
          Type
        </label>
        <Select
          id="account-type"
          value={type()}
          onChange={(e) => setType(e.currentTarget.value)}
        >
          <option value="bank">Bank</option>
          <option value="wallet">Wallet</option>
          <option value="cash">Cash</option>
          <option value="savings">Savings</option>
          <option value="credit_card">Credit Card</option>
          <option value="investment">Investment</option>
        </Select>
      </div>

      <div>
        <label for="account-currency" class={labelClass}>
          Currency
        </label>
        <Select
          id="account-currency"
          value={currency()}
          onChange={(e) => setCurrency(e.currentTarget.value)}
        >
          <option value="INR">INR</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
        </Select>
      </div>

      <Show when={!props.existing}>
        <div>
          <label for="account-opening-balance" class={labelClass}>
            Opening Balance
          </label>
          <Input
            id="account-opening-balance"
            class="font-mono tabular"
            type="number"
            inputmode="decimal"
            min="0"
            step="0.01"
            placeholder="0"
            value={openingBalance()}
            onInput={(e) => setOpeningBalance(e.currentTarget.value)}
          />
        </div>
      </Show>

      <Show when={type() === "credit_card"}>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-3">
        <div>
          <label for="account-credit-limit" class={labelClass}>
            Credit Limit
          </label>
          <Input
            id="account-credit-limit"
            class="font-mono tabular"
            type="number"
            min="0"
            step="0.01"
            placeholder="0"
            value={creditLimit()}
            onInput={(e) => setCreditLimit(e.currentTarget.value)}
          />
        </div>
        <div>
          <label for="account-statement-day" class={labelClass}>
            Statement Day
          </label>
          <Input
            id="account-statement-day"
            class="font-mono tabular"
            type="number"
            min="1"
            max="31"
            step="1"
            placeholder="e.g. 1"
            value={statementDay()}
            onInput={(e) => setStatementDay(e.currentTarget.value)}
          />
        </div>
        <div>
          <label for="account-payment-due-day" class={labelClass}>
            Payment Due Day
          </label>
          <Input
            id="account-payment-due-day"
            class="font-mono tabular"
            type="number"
            min="1"
            max="31"
            step="1"
            placeholder="e.g. 15"
            value={paymentDueDay()}
            onInput={(e) => setPaymentDueDay(e.currentTarget.value)}
          />
        </div>
        </div>
      </Show>

      <Show when={error()}>
        <p class="text-neg text-[13px]" role="alert">{error()}</p>
      </Show>

      <Button type="submit" size="lg" class="w-full mt-1" disabled={submitting()}>
        {submitting() ? "Saving…" : props.existing ? "Save changes" : "Add account"}
      </Button>
    </form>
  );
}
