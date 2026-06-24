import { createSignal, createResource, createMemo, For, Show } from "solid-js";
import { api } from "../../lib/api";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Button } from "../ui/button";
import { SegmentedControl } from "../ui/segmented-control";
import { cn } from "../../lib/utils";

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

interface Tag {
  id: string;
  name: string;
  color: string;
}

type TxType = "expense" | "income" | "transfer";

type TransactionFormProps = {
  onSuccess: () => void;
  onClose: () => void;
  existing?: {
    id: string;
    type: "expense" | "income" | "transfer";
    amount: string;
    currency: string;
    date: string;
    category_id?: string;
    title?: string;
    note?: string;
    account_id: string;
    transfer_to_id?: string;
    tags?: Tag[];
  };
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TransactionForm(props: TransactionFormProps) {
  const [accounts] = createResource(() => api.get<Account[]>("/v1/accounts"));
  const [categories] = createResource(() => api.get<Category[]>("/v1/categories"));
  const [availableTags] = createResource(() => api.get<Tag[]>("/v1/tags"));

  const [txType, setTxType] = createSignal<TxType>(props.existing?.type ?? "expense");
  const [amount, setAmount] = createSignal(props.existing?.amount ?? "");
  const [accountId, setAccountId] = createSignal(props.existing?.account_id ?? "");
  const [transferToId, setTransferToId] = createSignal(props.existing?.transfer_to_id ?? "");
  const [categoryId, setCategoryId] = createSignal(props.existing?.category_id ?? "");
  const [title, setTitle] = createSignal(props.existing?.title ?? "");
  const [date, setDate] = createSignal(props.existing?.date ?? todayISO());
  const [note, setNote] = createSignal(props.existing?.note ?? "");
  const [currency] = createSignal(props.existing?.currency ?? "INR");

  const initialTagIds = () => (props.existing?.tags ?? []).map((t) => t.id);
  const [selectedTagIds, setSelectedTagIds] = createSignal<string[]>(initialTagIds());

  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal("");

  const [makeRecurring, setMakeRecurring] = createSignal(false);
  const [recFrequency, setRecFrequency] = createSignal<"weekly" | "monthly" | "custom">("monthly");
  const [recIntervalValue, setRecIntervalValue] = createSignal("1");
  const [recIntervalUnit, setRecIntervalUnit] = createSignal<"day" | "week" | "month">("month");
  const [recStartDate, setRecStartDate] = createSignal(new Date().toISOString().slice(0, 10));
  const [recEndDate, setRecEndDate] = createSignal("");

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
      const body: Record<string, unknown> = {
        account_id: accountId(),
        type: txType(),
        amount: amt,
        currency: currency(),
        date: date(),
        ...(categoryId() ? { category_id: categoryId() } : {}),
        ...(title() ? { title: title() } : {}),
        ...(note() ? { note: note() } : {}),
        ...(txType() === "transfer" && transferToId() ? { transfer_to_id: transferToId() } : {}),
        tags: selectedTagIds(),
      };
      if (props.existing) {
        await api.put(`/v1/transactions/${props.existing.id}`, body);
      } else {
        await api.post("/v1/transactions", body);
      }
      if (makeRecurring()) {
        try {
          const ruleName = title() || note() || `${txType()} ${amt}`;
          const recurringBody: Record<string, unknown> = {
            name: ruleName,
            account_id: accountId(),
            type: txType(),
            amount: amt,
            currency: currency(),
            frequency: recFrequency(),
            start_date: recStartDate(),
            ...(categoryId() ? { category_id: categoryId() } : {}),
            ...(txType() === "transfer" && transferToId() ? { transfer_to_id: transferToId() } : {}),
            ...(title() ? { title: title() } : {}),
            ...(note() ? { note: note() } : {}),
            ...(recFrequency() === "custom"
              ? {
                  interval_value: parseInt(recIntervalValue(), 10) || 1,
                  interval_unit: recIntervalUnit(),
                }
              : {}),
            ...(recEndDate() ? { end_date: recEndDate() } : {}),
          };
          await api.post("/v1/recurring", recurringBody);
        } catch (recErr) {
          console.error("Failed to create recurring rule:", recErr);
        }
      }
      props.onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save transaction.");
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

      {/* To Account (transfer only) */}
      <Show when={txType() === "transfer"}>
        <div class="flex flex-col gap-1.5">
          <label class="text-[13px] font-body font-medium text-muted uppercase tracking-wide">To Account</label>
          <Show when={accounts.loading}>
            <Select disabled>
              <option>Loading…</option>
            </Select>
          </Show>
          <Show when={!accounts.loading}>
            <Select
              value={transferToId()}
              onChange={(e) => setTransferToId(e.currentTarget.value)}
              required
            >
              <option value="">Select destination account…</option>
              <For each={(accounts() ?? []).filter((acc) => acc.id !== accountId())}>
                {(acc) => <option value={acc.id}>{acc.name}</option>}
              </For>
            </Select>
          </Show>
        </div>
      </Show>

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

      {/* Recurring */}
      <div class="border-t border-border pt-4 mt-4 space-y-3">
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={makeRecurring()} onChange={(e) => setMakeRecurring(e.currentTarget.checked)} class="w-4 h-4 accent-primary" />
          <span class="font-body text-sm text-text">Make this recurring</span>
        </label>
        <Show when={makeRecurring()}>
          <div class="space-y-3 pl-6">
            <label class="block">
              <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-2 block">Frequency</span>
              <select value={recFrequency()} onChange={(e) => setRecFrequency(e.currentTarget.value as "weekly" | "monthly" | "custom")} class="w-full px-3 py-2 rounded-input bg-bg border border-border text-text font-body">
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <Show when={recFrequency() === "custom"}>
              <div class="grid grid-cols-2 gap-2">
                <label class="block">
                  <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-2 block">Every N</span>
                  <input type="number" min="1" value={recIntervalValue()} onInput={(e) => setRecIntervalValue(e.currentTarget.value)} class="w-full px-3 py-2 rounded-input bg-bg border border-border text-text font-body" />
                </label>
                <label class="block">
                  <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-2 block">Unit</span>
                  <select value={recIntervalUnit()} onChange={(e) => setRecIntervalUnit(e.currentTarget.value as "day" | "week" | "month")} class="w-full px-3 py-2 rounded-input bg-bg border border-border text-text font-body">
                    <option value="day">Days</option>
                    <option value="week">Weeks</option>
                    <option value="month">Months</option>
                  </select>
                </label>
              </div>
            </Show>
            <div class="grid grid-cols-2 gap-2">
              <label class="block">
                <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-2 block">Start date</span>
                <input type="date" value={recStartDate()} onInput={(e) => setRecStartDate(e.currentTarget.value)} class="w-full px-3 py-2 rounded-input bg-bg border border-border text-text font-body" />
              </label>
              <label class="block">
                <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-2 block">End date (optional)</span>
                <input type="date" value={recEndDate()} onInput={(e) => setRecEndDate(e.currentTarget.value)} class="w-full px-3 py-2 rounded-input bg-bg border border-border text-text font-body" />
              </label>
            </div>
          </div>
        </Show>
      </div>

      {/* Submit */}
      <Button type="submit" class="w-full" disabled={submitting()}>
        {submitting() ? (props.existing ? "Saving…" : "Adding…") : (props.existing ? "Save Changes" : "Add Transaction")}
      </Button>
    </form>
  );
}
