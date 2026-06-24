import { createResource, createSignal, For, Show } from "solid-js";
import { RotateCw, Pause, Play, Pencil, Trash2, Zap } from "lucide-solid";
import { api } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { Button } from "../components/ui/button";
import { Sheet } from "../components/ui/sheet";
import { SkeletonBlock } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";

interface Rule {
  id: string;
  name: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  currency: string;
  account_id: string;
  category_id?: string | null;
  transfer_to_id?: string | null;
  title?: string | null;
  note?: string | null;
  frequency: "weekly" | "monthly" | "custom";
  interval_value?: number | null;
  interval_unit?: "day" | "week" | "month" | null;
  start_date: string;
  end_date?: string | null;
  next_due_date: string;
  last_generated_date?: string | null;
  status: "active" | "paused";
}

interface Account {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
  type: "income" | "expense";
}

function frequencyLabel(r: Rule): string {
  if (r.frequency === "weekly") return "Every week";
  if (r.frequency === "monthly") return "Every month";
  const n = r.interval_value ?? 0;
  const u = r.interval_unit ?? "";
  const plural = n === 1 ? "" : "s";
  return `Every ${n} ${u}${plural}`;
}

function daysUntil(date: string): number {
  const d = new Date(date + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

function dueLabel(date: string): string {
  const d = daysUntil(date);
  if (d === 0) return "today";
  if (d < 0) return `${-d} day${d === -1 ? "" : "s"} overdue`;
  return `in ${d} day${d === 1 ? "" : "s"}`;
}

export default function Recurring() {
  const [rules, { refetch }] = createResource(() => api.get<Rule[]>("/v1/recurring"));
  const [accounts] = createResource(() =>
    api.get<Account[]>("/v1/accounts").catch(() => [] as Account[])
  );
  const [categories] = createResource(() =>
    api.get<Category[]>("/v1/categories").catch(() => [] as Category[])
  );
  const [editRule, setEditRule] = createSignal<Rule | null>(null);
  const [sheetOpen, setSheetOpen] = createSignal(false);
  const [runningNow, setRunningNow] = createSignal(false);
  const [runMessage, setRunMessage] = createSignal<string | null>(null);

  const openNew = () => {
    setEditRule(null);
    setSheetOpen(true);
  };
  const openEdit = (r: Rule) => {
    setEditRule(r);
    setSheetOpen(true);
  };

  const toggleStatus = async (r: Rule) => {
    const newStatus = r.status === "active" ? "paused" : "active";
    try {
      await api.post(`/v1/recurring/${r.id}/status`, { status: newStatus });
      refetch();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to update status");
    }
  };

  const remove = async (r: Rule) => {
    if (!confirm(`Delete recurring rule "${r.name}"?`)) return;
    try {
      await api.delete(`/v1/recurring/${r.id}/`);
      refetch();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete rule");
    }
  };

  const runNow = async () => {
    setRunningNow(true);
    setRunMessage(null);
    try {
      const res = await api.post<{ generated: number }>("/v1/recurring/run-now", {});
      setRunMessage(
        `Generated ${res.generated} transaction${res.generated === 1 ? "" : "s"}`
      );
      refetch();
    } catch (e) {
      setRunMessage(e instanceof Error ? e.message : "Failed to run");
    } finally {
      setRunningNow(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Recurring"
        actions={
          <div class="flex items-center gap-2">
            <Button variant="outline" disabled={runningNow()} onClick={runNow}>
              <Zap size={16} />
              <span>{runningNow() ? "Running…" : "Run Now"}</span>
            </Button>
            <Button onClick={openNew}>
              <RotateCw size={16} />
              <span>New Rule</span>
            </Button>
          </div>
        }
      />

      <Show when={runMessage()}>
        <div class="px-4 md:px-6 pt-3">
          <div class="px-4 py-2 rounded-input bg-surface text-sm text-text border border-border">
            {runMessage()}
          </div>
        </div>
      </Show>

      <div class="p-4 md:p-6">
        <Show when={rules.loading}>
          <SkeletonBlock class="min-h-[200px]" />
        </Show>
        <Show when={!rules.loading && (rules() ?? []).length > 0}>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <For each={rules()}>
              {(r) => (
                <BentoBlock>
                  <div class="flex items-start justify-between gap-3 mb-2">
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="font-body font-medium text-text truncate">
                        {r.name}
                      </span>
                      <span
                        class={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full font-body shrink-0 ${
                          r.status === "active"
                            ? "bg-primary/15 text-primary"
                            : "bg-muted/15 text-muted"
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>
                  </div>
                  <div class="text-sm text-muted mb-3 space-y-1">
                    <div class="font-body">
                      {frequencyLabel(r)} • {formatCurrency(r.amount, r.currency)}
                    </div>
                    <div class="font-body text-xs">
                      Next: {r.next_due_date} ({dueLabel(r.next_due_date)})
                    </div>
                  </div>
                  <div class="flex items-center gap-1">
                    <button
                      type="button"
                      class="w-8 h-8 flex items-center justify-center rounded-input hover:bg-surface-hover text-muted hover:text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                      onClick={() => toggleStatus(r)}
                      title={r.status === "active" ? "Pause" : "Resume"}
                      aria-label={r.status === "active" ? `Pause ${r.name}` : `Resume ${r.name}`}
                    >
                      <Show
                        when={r.status === "active"}
                        fallback={<Play size={14} />}
                      >
                        <Pause size={14} />
                      </Show>
                    </button>
                    <button
                      type="button"
                      class="w-8 h-8 flex items-center justify-center rounded-input hover:bg-surface-hover text-muted hover:text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                      onClick={() => openEdit(r)}
                      title="Edit"
                      aria-label={`Edit ${r.name}`}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      class="w-8 h-8 flex items-center justify-center rounded-input hover:bg-surface-hover text-muted hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                      onClick={() => remove(r)}
                      title="Delete"
                      aria-label={`Delete ${r.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </BentoBlock>
              )}
            </For>
          </div>
        </Show>
        <Show when={!rules.loading && (rules() ?? []).length === 0}>
          <BentoBlock>
            <EmptyState
              icon={RotateCw}
              title="No recurring rules yet"
              body="Set up rent, salary, subscriptions — anything that repeats on a schedule."
            />
          </BentoBlock>
        </Show>
      </div>

      <Sheet
        open={sheetOpen()}
        onClose={() => setSheetOpen(false)}
        title={editRule() ? "Edit Rule" : "New Rule"}
      >
        <RecurringForm
          existing={editRule()}
          accounts={accounts() ?? []}
          categories={categories() ?? []}
          onClose={() => setSheetOpen(false)}
          onSaved={() => {
            setSheetOpen(false);
            refetch();
          }}
        />
      </Sheet>
    </>
  );
}

type Frequency = "weekly" | "monthly" | "custom";
type TxType = "income" | "expense" | "transfer";
type IntervalUnit = "day" | "week" | "month";

function RecurringForm(props: {
  existing: Rule | null;
  accounts: Account[];
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = createSignal(props.existing?.name ?? "");
  const [type, setType] = createSignal<TxType>(props.existing?.type ?? "expense");
  const [amount, setAmount] = createSignal(
    props.existing?.amount != null ? props.existing.amount.toString() : ""
  );
  const [currency, setCurrency] = createSignal(props.existing?.currency ?? "INR");
  const [accountId, setAccountId] = createSignal(props.existing?.account_id ?? "");
  const [categoryId, setCategoryId] = createSignal(props.existing?.category_id ?? "");
  const [title, setTitle] = createSignal(props.existing?.title ?? "");
  const [note, setNote] = createSignal(props.existing?.note ?? "");
  const [frequency, setFrequency] = createSignal<Frequency>(
    props.existing?.frequency ?? "monthly"
  );
  const [intervalValue, setIntervalValue] = createSignal(
    props.existing?.interval_value != null
      ? props.existing.interval_value.toString()
      : "1"
  );
  const [intervalUnit, setIntervalUnit] = createSignal<IntervalUnit>(
    (props.existing?.interval_unit as IntervalUnit) ?? "month"
  );
  const [startDate, setStartDate] = createSignal(
    props.existing?.start_date ?? new Date().toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = createSignal(props.existing?.end_date ?? "");
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: name(),
        type: type(),
        amount: parseFloat(amount()),
        currency: currency(),
        account_id: accountId(),
        category_id: categoryId() || undefined,
        title: title() || undefined,
        note: note() || undefined,
        frequency: frequency(),
        start_date: startDate(),
        end_date: endDate() || undefined,
      };
      if (frequency() === "custom") {
        body.interval_value = parseInt(intervalValue());
        body.interval_unit = intervalUnit();
      }
      if (props.existing) {
        await api.put(`/v1/recurring/${props.existing.id}/`, body);
      } else {
        await api.post("/v1/recurring", body);
      }
      props.onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCats = () =>
    type() === "transfer"
      ? []
      : props.categories.filter((c) => c.type === type());

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      class="space-y-4"
    >
      <label class="block">
        <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-2 block">
          Name
        </span>
        <input
          type="text"
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
          required
          class="w-full px-3 py-2 rounded-input bg-bg border border-border text-text font-body"
          placeholder="Rent, Salary, Netflix..."
        />
      </label>
      <label class="block">
        <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-2 block">
          Type
        </span>
        <select
          value={type()}
          onChange={(e) => setType(e.currentTarget.value as TxType)}
          class="w-full px-3 py-2 rounded-input bg-bg border border-border text-text font-body"
        >
          <option value="expense">Expense</option>
          <option value="income">Income</option>
          <option value="transfer">Transfer</option>
        </select>
      </label>
      <div class="grid grid-cols-2 gap-2">
        <label class="block">
          <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-2 block">
            Amount
          </span>
          <input
            type="number"
            step="0.01"
            value={amount()}
            onInput={(e) => setAmount(e.currentTarget.value)}
            required
            class="w-full px-3 py-2 rounded-input bg-bg border border-border text-text font-body"
          />
        </label>
        <label class="block">
          <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-2 block">
            Currency
          </span>
          <input
            type="text"
            value={currency()}
            onInput={(e) => setCurrency(e.currentTarget.value)}
            maxLength="3"
            required
            class="w-full px-3 py-2 rounded-input bg-bg border border-border text-text font-body"
          />
        </label>
      </div>
      <label class="block">
        <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-2 block">
          Account
        </span>
        <select
          value={accountId()}
          onChange={(e) => setAccountId(e.currentTarget.value)}
          required
          class="w-full px-3 py-2 rounded-input bg-bg border border-border text-text font-body"
        >
          <option value="">Select account…</option>
          <For each={props.accounts}>
            {(a) => <option value={a.id}>{a.name}</option>}
          </For>
        </select>
      </label>
      <Show when={type() !== "transfer"}>
        <label class="block">
          <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-2 block">
            Category
          </span>
          <select
            value={categoryId()}
            onChange={(e) => setCategoryId(e.currentTarget.value)}
            class="w-full px-3 py-2 rounded-input bg-bg border border-border text-text font-body"
          >
            <option value="">None</option>
            <For each={filteredCats()}>
              {(c) => <option value={c.id}>{c.name}</option>}
            </For>
          </select>
        </label>
      </Show>
      <label class="block">
        <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-2 block">
          Title (optional)
        </span>
        <input
          type="text"
          value={title()}
          onInput={(e) => setTitle(e.currentTarget.value)}
          class="w-full px-3 py-2 rounded-input bg-bg border border-border text-text font-body"
        />
      </label>
      <label class="block">
        <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-2 block">
          Note (optional)
        </span>
        <textarea
          value={note()}
          onInput={(e) => setNote(e.currentTarget.value)}
          rows={2}
          class="w-full px-3 py-2 rounded-input bg-bg border border-border text-text font-body"
        />
      </label>
      <label class="block">
        <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-2 block">
          Frequency
        </span>
        <select
          value={frequency()}
          onChange={(e) => setFrequency(e.currentTarget.value as Frequency)}
          class="w-full px-3 py-2 rounded-input bg-bg border border-border text-text font-body"
        >
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="custom">Custom</option>
        </select>
      </label>
      <Show when={frequency() === "custom"}>
        <div class="grid grid-cols-2 gap-2">
          <label class="block">
            <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-2 block">
              Every N
            </span>
            <input
              type="number"
              min="1"
              value={intervalValue()}
              onInput={(e) => setIntervalValue(e.currentTarget.value)}
              required
              class="w-full px-3 py-2 rounded-input bg-bg border border-border text-text font-body"
            />
          </label>
          <label class="block">
            <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-2 block">
              Unit
            </span>
            <select
              value={intervalUnit()}
              onChange={(e) => setIntervalUnit(e.currentTarget.value as IntervalUnit)}
              class="w-full px-3 py-2 rounded-input bg-bg border border-border text-text font-body"
            >
              <option value="day">Days</option>
              <option value="week">Weeks</option>
              <option value="month">Months</option>
            </select>
          </label>
        </div>
      </Show>
      <div class="grid grid-cols-2 gap-2">
        <label class="block">
          <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-2 block">
            Start date
          </span>
          <input
            type="date"
            value={startDate()}
            onInput={(e) => setStartDate(e.currentTarget.value)}
            required
            class="w-full px-3 py-2 rounded-input bg-bg border border-border text-text font-body"
          />
        </label>
        <label class="block">
          <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-2 block">
            End date (optional)
          </span>
          <input
            type="date"
            value={endDate()}
            onInput={(e) => setEndDate(e.currentTarget.value)}
            class="w-full px-3 py-2 rounded-input bg-bg border border-border text-text font-body"
          />
        </label>
      </div>
      <Show when={error()}>
        <p class="text-accent text-sm">{error()}</p>
      </Show>
      <div class="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={props.onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting()}>
          {submitting() ? "Saving…" : props.existing ? "Update" : "Create"}
        </Button>
      </div>
    </form>
  );
}