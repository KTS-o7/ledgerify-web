import { createSignal, createResource, createMemo, For, Show } from "solid-js";
import { api } from "../../lib/api";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Button } from "../ui/button";
import { SegmentedControl } from "../ui/segmented-control";

interface Account {
  id: string;
  name: string;
  type: string;
  currency: string;
}

interface Category {
  id: string;
  name: string;
  type: string;
}

type TxType = "expense" | "income" | "transfer";

type TransactionFormProps = {
  onSuccess: () => void;
  onClose: () => void;
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TransactionForm(props: TransactionFormProps) {
  const [accounts] = createResource(() => api.get<Account[]>("/v1/accounts"));
  const [categories] = createResource(() => api.get<Category[]>("/v1/categories"));

  const [txType, setTxType] = createSignal<TxType>("expense");
  const [amount, setAmount] = createSignal("");
  const [accountId, setAccountId] = createSignal("");
  const [categoryId, setCategoryId] = createSignal("");
  const [title, setTitle] = createSignal("");
  const [date, setDate] = createSignal(todayISO());
  const [note, setNote] = createSignal("");
  const [currency] = createSignal("INR");

  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal("");

  const filteredCategories = createMemo(() => {
    const all = categories() ?? [];
    const t = txType();
    if (t === "transfer") return all;
    return all.filter((c) => c.type === t || c.type === "both" || !c.type);
  });

  const typeOptions: { value: TxType; label: string }[] = [
    { value: "expense", label: "Expense" },
    { value: "income", label: "Income" },
    { value: "transfer", label: "Transfer" },
  ];

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError("");

    const amt = parseFloat(amount());
    if (isNaN(amt) || amt <= 0) {
      setError("Please enter a valid amount.");
      return;
    }
    if (!accountId()) {
      setError("Please select an account.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/v1/transactions", {
        account_id: accountId(),
        type: txType(),
        amount: amt,
        currency: currency(),
        date: date(),
        ...(categoryId() ? { category_id: categoryId() } : {}),
        ...(title() ? { title: title() } : {}),
        ...(note() ? { note: note() } : {}),
      });
      props.onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add transaction.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} class="flex flex-col gap-4">
      {/* Type */}
      <div class="flex flex-col gap-1.5">
        <label class="text-[13px] font-body font-medium text-muted uppercase tracking-wide">Type</label>
        <SegmentedControl
          options={typeOptions}
          value={txType()}
          onChange={setTxType}
          ariaLabel="Transaction type"
        />
      </div>

      {/* Amount */}
      <div class="flex flex-col gap-1.5">
        <label class="text-[13px] font-body font-medium text-muted uppercase tracking-wide">Amount</label>
        <Input
          type="number"
          min="0.01"
          step="0.01"
          placeholder="0.00"
          value={amount()}
          onInput={(e) => setAmount(e.currentTarget.value)}
          required
        />
      </div>

      {/* Account */}
      <div class="flex flex-col gap-1.5">
        <label class="text-[13px] font-body font-medium text-muted uppercase tracking-wide">Account</label>
        <Show when={accounts.loading}>
          <Select disabled>
            <option>Loading…</option>
          </Select>
        </Show>
        <Show when={!accounts.loading}>
          <Select
            value={accountId()}
            onChange={(e) => setAccountId(e.currentTarget.value)}
            required
          >
            <option value="">Select account…</option>
            <For each={accounts() ?? []}>
              {(acc) => <option value={acc.id}>{acc.name}</option>}
            </For>
          </Select>
        </Show>
      </div>

      {/* Category */}
      <div class="flex flex-col gap-1.5">
        <label class="text-[13px] font-body font-medium text-muted uppercase tracking-wide">Category</label>
        <Show when={categories.loading}>
          <Select disabled>
            <option>Loading…</option>
          </Select>
        </Show>
        <Show when={!categories.loading}>
          <Select
            value={categoryId()}
            onChange={(e) => setCategoryId(e.currentTarget.value)}
          >
            <option value="">No category</option>
            <For each={filteredCategories()}>
              {(cat) => <option value={cat.id}>{cat.name}</option>}
            </For>
          </Select>
        </Show>
      </div>

      {/* Title */}
      <div class="flex flex-col gap-1.5">
        <label class="text-[13px] font-body font-medium text-muted uppercase tracking-wide">Description</label>
        <Input
          type="text"
          placeholder="Description (optional)"
          value={title()}
          onInput={(e) => setTitle(e.currentTarget.value)}
        />
      </div>

      {/* Date */}
      <div class="flex flex-col gap-1.5">
        <label class="text-[13px] font-body font-medium text-muted uppercase tracking-wide">Date</label>
        <Input
          type="date"
          value={date()}
          onInput={(e) => setDate(e.currentTarget.value)}
          required
        />
      </div>

      {/* Note */}
      <div class="flex flex-col gap-1.5">
        <label class="text-[13px] font-body font-medium text-muted uppercase tracking-wide">Note</label>
        <Input
          type="text"
          placeholder="Note (optional)"
          value={note()}
          onInput={(e) => setNote(e.currentTarget.value)}
        />
      </div>

      {/* Error */}
      <Show when={error()}>
        <p class="text-accent text-sm">{error()}</p>
      </Show>

      {/* Submit */}
      <Button type="submit" class="w-full" disabled={submitting()}>
        {submitting() ? "Adding…" : "Add Transaction"}
      </Button>
    </form>
  );
}
