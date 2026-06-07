import { createSignal } from "solid-js";
import { api } from "../../lib/api";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Button } from "../ui/button";
import { Show } from "solid-js";

type AccountFormProps = {
  onSuccess: () => void;
  onClose: () => void;
  existing?: {
    id: string;
    name: string;
    type: string;
    currency: string;
  };
};

export function AccountForm(props: AccountFormProps) {
  const [name, setName] = createSignal(props.existing?.name ?? "");
  const [type, setType] = createSignal(props.existing?.type ?? "bank");
  const [currency, setCurrency] = createSignal(props.existing?.currency ?? "INR");
  const [openingBalance, setOpeningBalance] = createSignal("");
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
      if (props.existing) {
        await api.put(`/v1/accounts/${props.existing.id}`, {
          name: name().trim(),
          type: type(),
          currency: currency(),
        });
      } else {
        const body: Record<string, unknown> = {
          name: name().trim(),
          type: type(),
          currency: currency(),
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
        <label for="account-name" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
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
        <label for="account-type" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
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
        <label for="account-currency" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
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
          <label for="account-opening-balance" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
            Opening Balance
          </label>
          <Input
            id="account-opening-balance"
            type="number"
            min="0"
            step="0.01"
            placeholder="0"
            value={openingBalance()}
            onInput={(e) => setOpeningBalance(e.currentTarget.value)}
          />
        </div>
      </Show>

      <Show when={error()}>
        <p class="text-accent text-sm">{error()}</p>
      </Show>

      <Button type="submit" class="w-full" disabled={submitting()}>
        {submitting() ? "Saving…" : props.existing ? "Save Changes" : "Save"}
      </Button>
    </form>
  );
}
