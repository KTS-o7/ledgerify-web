import { createResource, createSignal, For, Show } from "solid-js";
import { api } from "../../lib/api";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Button } from "../ui/button";
import { SegmentedControl } from "../ui/segmented-control";

type Category = {
  id: string;
  name: string;
  type: string;
  color: string;
};

type BudgetFormProps = {
  onSuccess: () => void;
  onClose: () => void;
};

export function BudgetForm(props: BudgetFormProps) {
  const [name, setName] = createSignal("");
  const [amount, setAmount] = createSignal("");
  const [currency, setCurrency] = createSignal("INR");
  const [periodType, setPeriodType] = createSignal<"monthly" | "weekly" | "yearly">("monthly");
  const [categoryId, setCategoryId] = createSignal("");
  const [rollover, setRollover] = createSignal(false);
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal("");

  const [categories] = createResource(() => api.get<Category[]>("/v1/categories"));

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    setError("");

    if (!name().trim()) {
      setError("Name is required.");
      return;
    }
    if (!amount().trim() || parseFloat(amount()) <= 0) {
      setError("Amount must be greater than 0.");
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        name: name().trim(),
        amount: parseFloat(amount()),
        currency: currency(),
        period_type: periodType(),
        rollover: rollover(),
      };
      if (categoryId()) {
        body.category_id = categoryId();
      }
      await api.post("/v1/budgets", body);
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
        <label for="budget-name" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
          Name
        </label>
        <Input
          id="budget-name"
          type="text"
          placeholder="e.g. Groceries"
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
          required
        />
      </div>

      <div>
        <label for="budget-amount" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
          Amount
        </label>
        <Input
          id="budget-amount"
          type="number"
          min="1"
          step="0.01"
          value={amount()}
          onInput={(e) => setAmount(e.currentTarget.value)}
          required
        />
      </div>

      <div>
        <label class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
          Period
        </label>
        <SegmentedControl
          options={[
            { value: "monthly", label: "Monthly" },
            { value: "weekly", label: "Weekly" },
            { value: "yearly", label: "Yearly" },
          ]}
          value={periodType()}
          onChange={(v) => setPeriodType(v)}
          ariaLabel="Budget period"
        />
      </div>

      <div>
        <label for="budget-currency" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
          Currency
        </label>
        <Select
          id="budget-currency"
          value={currency()}
          onChange={(e) => setCurrency(e.currentTarget.value)}
        >
          <option value="INR">INR</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
        </Select>
      </div>

      <div>
        <label for="budget-category" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
          Category
        </label>
        <Select
          id="budget-category"
          value={categoryId()}
          onChange={(e) => setCategoryId(e.currentTarget.value)}
        >
          <option value="">No category</option>
          <For each={categories() ?? []}>
            {(cat) => <option value={cat.id}>{cat.name}</option>}
          </For>
        </Select>
      </div>

      <div>
        <label class="flex items-center gap-3 h-12 cursor-pointer">
          <input
            type="checkbox"
            class="w-4 h-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-bg"
            checked={rollover()}
            onChange={(e) => setRollover(e.currentTarget.checked)}
          />
          <span class="text-base text-text font-body">Roll over unused budget</span>
        </label>
      </div>

      <Show when={error()}>
        <p class="text-accent text-sm">{error()}</p>
      </Show>

      <Button type="submit" class="w-full" disabled={submitting()}>
        {submitting() ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
