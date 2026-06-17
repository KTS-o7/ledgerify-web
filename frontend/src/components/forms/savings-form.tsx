import { createResource, createSignal, For, Show } from "solid-js";
import { api } from "../../lib/api";
import { numericToFloat, pgDateToString, pgTextToString } from "../../lib/format";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { SegmentedControl } from "../ui/segmented-control";
import { Button } from "../ui/button";

const STATUS_OPTIONS = [
  { value: "active" as const, label: "Active" },
  { value: "achieved" as const, label: "Achieved" },
  { value: "abandoned" as const, label: "Abandoned" },
];

const CURRENCY_OPTIONS = ["INR", "USD", "EUR", "GBP"];

type GoalStatus = "active" | "achieved" | "abandoned";

type Account = {
  id: string;
  name: string;
};

type SavingsFormProps = {
  onSuccess: () => void;
  onClose: () => void;
  existing?: {
    id: string;
    name: string;
    target_amount: unknown;
    current_amount: unknown;
    currency: string;
    deadline: unknown;
    status: GoalStatus;
    description?: unknown;
    linked_account_id?: unknown;
  };
};

export function SavingsForm(props: SavingsFormProps) {
  const [name, setName] = createSignal(props.existing?.name ?? "");
  const [targetAmount, setTargetAmount] = createSignal(
    numericToFloat(props.existing?.target_amount)?.toString() ?? ""
  );
  const [currentAmount, setCurrentAmount] = createSignal(
    numericToFloat(props.existing?.current_amount)?.toString() ?? ""
  );
  const [currency, setCurrency] = createSignal(props.existing?.currency ?? "INR");
  const [deadline, setDeadline] = createSignal(pgDateToString(props.existing?.deadline) ?? "");
  const [status, setStatus] = createSignal<GoalStatus>(props.existing?.status ?? "active");
  const [description, setDescription] = createSignal(pgTextToString(props.existing?.description) ?? "");
  const [linkedAccountId, setLinkedAccountId] = createSignal(
    (props.existing?.linked_account_id as string) ?? ""
  );

  const [accounts] = createResource(() => api.get<Account[]>("/v1/accounts").catch(() => [] as Account[]));

  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal("");

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!name().trim()) {
      setError("Goal name is required.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        name: name().trim(),
        currency: currency(),
        status: status(),
      };
      if (targetAmount()) body.target_amount = parseFloat(targetAmount());
      if (currentAmount()) body.current_amount = parseFloat(currentAmount());
      if (deadline()) body.deadline = deadline();
      if (description().trim()) body.description = description().trim();
      if (linkedAccountId()) body.linked_account_id = linkedAccountId();
      if (props.existing) {
        await api.put(`/v1/savings/${props.existing.id}`, body);
      } else {
        await api.post("/v1/savings", body);
      }
      props.onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save goal.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} class="flex flex-col gap-4">
      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium text-muted" for="sg-name">Goal Name</label>
        <Input
          id="sg-name"
          type="text"
          placeholder="e.g. Emergency Fund"
          required
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
        />
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium text-muted" for="sg-target">Target Amount</label>
        <Input
          id="sg-target"
          type="number"
          min="0"
          step="0.01"
          placeholder="0"
          value={targetAmount()}
          onInput={(e) => setTargetAmount(e.currentTarget.value)}
        />
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium text-muted" for="sg-current">Current Amount</label>
        <Input
          id="sg-current"
          type="number"
          min="0"
          step="0.01"
          placeholder="0"
          value={currentAmount()}
          onInput={(e) => setCurrentAmount(e.currentTarget.value)}
        />
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium text-muted" for="sg-currency">Currency</label>
        <Select
          id="sg-currency"
          value={currency()}
          onChange={(e) => setCurrency((e.currentTarget as HTMLSelectElement).value)}
        >
          <For each={CURRENCY_OPTIONS}>
            {(c) => <option value={c}>{c}</option>}
          </For>
        </Select>
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium text-muted" for="sg-deadline">Deadline</label>
        <Input
          id="sg-deadline"
          type="date"
          value={deadline()}
          onInput={(e) => setDeadline(e.currentTarget.value)}
        />
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium text-muted" for="sg-description">Description</label>
        <textarea
          id="sg-description"
          rows={3}
          placeholder="Optional notes about this goal…"
          value={description()}
          onInput={(e) => setDescription(e.currentTarget.value)}
          class="w-full rounded-input border border-border bg-surface px-3 py-2 text-base text-text font-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-bg resize-none"
        />
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium text-muted" for="sg-linked-account">
          Linked Account
          <span class="ml-1 text-muted font-normal normal-case text-xs">(Optional — auto-syncs balance)</span>
        </label>
        <Select
          id="sg-linked-account"
          value={linkedAccountId()}
          onChange={(e) => setLinkedAccountId((e.currentTarget as HTMLSelectElement).value)}
        >
          <option value="">No linked account</option>
          <For each={accounts() ?? []}>
            {(acc) => <option value={acc.id}>{acc.name}</option>}
          </For>
        </Select>
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium text-muted">Status</label>
        <SegmentedControl
          options={STATUS_OPTIONS}
          value={status()}
          onChange={setStatus}
          ariaLabel="Goal status"
        />
      </div>

      <Show when={error()}>
        <p class="text-accent text-sm">{error()}</p>
      </Show>

      <Button type="submit" disabled={submitting()} class="w-full mt-2">
        {submitting() ? "Saving…" : props.existing ? "Save Changes" : "Create Goal"}
      </Button>
    </form>
  );
}
