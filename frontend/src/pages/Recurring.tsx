import { createResource, createSignal, For, Show } from "solid-js";
import { Repeat, Pause, Play, Pencil, Trash2, Zap, Plus } from "lucide-solid";
import { api } from "../lib/api";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { Button } from "../components/ui/button";
import { Sheet } from "../components/ui/sheet";
import { SkeletonBlock } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";
import { Money } from "../components/ui/money";
import { Badge } from "../components/ui/badge";
import { cn } from "../lib/utils";

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

const DUE_FMT = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
function formatDue(date: string): string {
  const d = new Date(date + "T00:00:00");
  return isNaN(d.getTime()) ? date : DUE_FMT.format(d);
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

  const sorted = () =>
    [...(rules() ?? [])].sort((x, y) =>
      x.status === y.status ? x.next_due_date.localeCompare(y.next_due_date) : x.status === "active" ? -1 : 1
    );

  return (
    <>
      <PageHeader
        title="Recurring"
        meta={(rules() ?? []).length > 0 ? String((rules() ?? []).length) : undefined}
        actions={
          <div class="flex items-center gap-2">
            <Button variant="outline" size="sm" class="h-9" disabled={runningNow()} onClick={runNow} aria-label="Run due rules now">
              <Zap size={15} />
              <span class="hidden md:inline">{runningNow() ? "Running…" : "Run now"}</span>
            </Button>
            <Button size="sm" class="h-9" onClick={openNew} aria-label="New rule">
              <Plus size={16} />
              <span class="hidden md:inline">New rule</span>
            </Button>
          </div>
        }
      />

      <Show when={runMessage()}>
        <div class="px-5 md:px-7 pt-4">
          <div role="status" class="px-4 py-2.5 rounded-[12px] bg-surface text-[13.5px] text-text border border-border">
            {runMessage()}
          </div>
        </div>
      </Show>

      <div class="px-5 md:px-7 py-5 md:py-6">
        <Show when={rules.loading}>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <SkeletonBlock class="h-[132px]" />
            <SkeletonBlock class="h-[132px]" />
          </div>
        </Show>
        <Show when={!rules.loading && (rules() ?? []).length > 0}>
          <ul class="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <For each={sorted()}>
              {(r) => {
                const overdue = () => r.status === "active" && daysUntil(r.next_due_date) < 0;
                return (
                  <li>
                    <BentoBlock class={cn("flex flex-col gap-3", r.status === "paused" && "opacity-70")}>
                      <div class="flex items-start gap-3">
                        <div class="w-[38px] h-[38px] shrink-0 rounded-[10px] bg-raised text-muted flex items-center justify-center" aria-hidden="true">
                          <Repeat size={17} />
                        </div>
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2 min-w-0">
                            <span class="text-[14.5px] font-medium text-text truncate">{r.name}</span>
                            <Badge variant={r.status === "active" ? "signal" : "default"} class="shrink-0 font-mono text-[10.5px] uppercase tracking-[0.06em]">
                              {r.status}
                            </Badge>
                          </div>
                          <div class="text-[12.5px] text-muted mt-0.5">{frequencyLabel(r)} · <span class="capitalize">{r.type}</span></div>
                        </div>
                        <span class="font-mono tabular text-[15px] shrink-0">
                          {r.type === "income" ? "+" : r.type === "expense" ? "−" : ""}
                          <Money value={r.amount} currency={r.currency} tone={r.type === "income" ? "pos" : r.type === "transfer" ? "muted" : "text"} />
                        </span>
                      </div>
                      <div class="flex items-center justify-between gap-2 pt-3 border-t border-border">
                        <div class="text-[12.5px] text-muted min-w-0 truncate">
                          Next <span class="font-mono tabular text-text">{formatDue(r.next_due_date)}</span>{" "}
                          <span class={cn("font-mono tabular", overdue() ? "text-warn" : "text-faint")}>· {dueLabel(r.next_due_date)}</span>
                        </div>
                        <div class="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            class="w-8 h-8 flex items-center justify-center rounded-[8px] text-muted hover:text-text hover:bg-raised transition-colors duration-[160ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
                            onClick={() => toggleStatus(r)}
                            title={r.status === "active" ? "Pause" : "Resume"}
                            aria-label={r.status === "active" ? `Pause ${r.name}` : `Resume ${r.name}`}
                          >
                            <Show when={r.status === "active"} fallback={<Play size={14} />}>
                              <Pause size={14} />
                            </Show>
                          </button>
                          <button type="button" class="w-8 h-8 flex items-center justify-center rounded-[8px] text-muted hover:text-text hover:bg-raised transition-colors duration-[160ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal" onClick={() => openEdit(r)} title="Edit" aria-label={`Edit ${r.name}`}>
                            <Pencil size={14} />
                          </button>
                          <button type="button" class="w-8 h-8 flex items-center justify-center rounded-[8px] text-muted hover:text-text hover:bg-raised transition-colors duration-[160ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal hover:text-neg" onClick={() => remove(r)} title="Delete" aria-label={`Delete ${r.name}`}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </BentoBlock>
                  </li>
                );
              }}
            </For>
          </ul>
        </Show>
        <Show when={!rules.loading && (rules() ?? []).length === 0}>
          <EmptyState
            icon={Repeat}
            title="Nothing repeats yet"
            body="Set up rent, salary, subscriptions — anything that repeats on a schedule."
            action={{ label: "New rule", onClick: openNew }}
          />
        </Show>
      </div>

      <Sheet
        open={sheetOpen()}
        onClose={() => setSheetOpen(false)}
        title={editRule() ? "Edit rule" : "New rule"}
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
        <span class="text-[12.5px] font-medium text-muted mb-1.5 block">
          Name
        </span>
        <input
          type="text"
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
          required
          class="w-full h-11 px-3.5 rounded-input bg-surface border border-border-strong text-[15px] text-text focus:outline-none focus:border-signal transition-colors duration-[160ms]"
          placeholder="Rent, Salary, Netflix..."
        />
      </label>
      <label class="block">
        <span class="text-[12.5px] font-medium text-muted mb-1.5 block">
          Type
        </span>
        <select
          value={type()}
          onChange={(e) => setType(e.currentTarget.value as TxType)}
          class="w-full h-11 px-3.5 rounded-input bg-surface border border-border-strong text-[15px] text-text focus:outline-none focus:border-signal transition-colors duration-[160ms]"
        >
          <option value="expense">Expense</option>
          <option value="income">Income</option>
          <option value="transfer">Transfer</option>
        </select>
      </label>
      <div class="grid grid-cols-2 gap-2">
        <label class="block">
          <span class="text-[12.5px] font-medium text-muted mb-1.5 block">
            Amount
          </span>
          <input
            type="number"
            step="0.01"
            value={amount()}
            onInput={(e) => setAmount(e.currentTarget.value)}
            required
            class="w-full h-11 px-3.5 font-mono tabular rounded-input bg-surface border border-border-strong text-[15px] text-text focus:outline-none focus:border-signal transition-colors duration-[160ms]"
          />
        </label>
        <label class="block">
          <span class="text-[12.5px] font-medium text-muted mb-1.5 block">
            Currency
          </span>
          <input
            type="text"
            value={currency()}
            onInput={(e) => setCurrency(e.currentTarget.value)}
            maxLength="3"
            required
            class="w-full h-11 px-3.5 rounded-input bg-surface border border-border-strong text-[15px] text-text focus:outline-none focus:border-signal transition-colors duration-[160ms]"
          />
        </label>
      </div>
      <label class="block">
        <span class="text-[12.5px] font-medium text-muted mb-1.5 block">
          Account
        </span>
        <select
          value={accountId()}
          onChange={(e) => setAccountId(e.currentTarget.value)}
          required
          class="w-full h-11 px-3.5 rounded-input bg-surface border border-border-strong text-[15px] text-text focus:outline-none focus:border-signal transition-colors duration-[160ms]"
        >
          <option value="">Select account…</option>
          <For each={props.accounts}>
            {(a) => <option value={a.id}>{a.name}</option>}
          </For>
        </select>
      </label>
      <Show when={type() !== "transfer"}>
        <label class="block">
          <span class="text-[12.5px] font-medium text-muted mb-1.5 block">
            Category
          </span>
          <select
            value={categoryId()}
            onChange={(e) => setCategoryId(e.currentTarget.value)}
            class="w-full h-11 px-3.5 rounded-input bg-surface border border-border-strong text-[15px] text-text focus:outline-none focus:border-signal transition-colors duration-[160ms]"
          >
            <option value="">None</option>
            <For each={filteredCats()}>
              {(c) => <option value={c.id}>{c.name}</option>}
            </For>
          </select>
        </label>
      </Show>
      <label class="block">
        <span class="text-[12.5px] font-medium text-muted mb-1.5 block">
          Title (optional)
        </span>
        <input
          type="text"
          value={title()}
          onInput={(e) => setTitle(e.currentTarget.value)}
          class="w-full h-11 px-3.5 rounded-input bg-surface border border-border-strong text-[15px] text-text focus:outline-none focus:border-signal transition-colors duration-[160ms]"
        />
      </label>
      <label class="block">
        <span class="text-[12.5px] font-medium text-muted mb-1.5 block">
          Note (optional)
        </span>
        <textarea
          value={note()}
          onInput={(e) => setNote(e.currentTarget.value)}
          rows={2}
          class="w-full py-2.5 px-3.5 rounded-input bg-surface border border-border-strong text-[15px] text-text focus:outline-none focus:border-signal transition-colors duration-[160ms]"
        />
      </label>
      <label class="block">
        <span class="text-[12.5px] font-medium text-muted mb-1.5 block">
          Frequency
        </span>
        <select
          value={frequency()}
          onChange={(e) => setFrequency(e.currentTarget.value as Frequency)}
          class="w-full h-11 px-3.5 rounded-input bg-surface border border-border-strong text-[15px] text-text focus:outline-none focus:border-signal transition-colors duration-[160ms]"
        >
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="custom">Custom</option>
        </select>
      </label>
      <Show when={frequency() === "custom"}>
        <div class="grid grid-cols-2 gap-2">
          <label class="block">
            <span class="text-[12.5px] font-medium text-muted mb-1.5 block">
              Every N
            </span>
            <input
              type="number"
              min="1"
              value={intervalValue()}
              onInput={(e) => setIntervalValue(e.currentTarget.value)}
              required
              class="w-full h-11 px-3.5 font-mono tabular rounded-input bg-surface border border-border-strong text-[15px] text-text focus:outline-none focus:border-signal transition-colors duration-[160ms]"
            />
          </label>
          <label class="block">
            <span class="text-[12.5px] font-medium text-muted mb-1.5 block">
              Unit
            </span>
            <select
              value={intervalUnit()}
              onChange={(e) => setIntervalUnit(e.currentTarget.value as IntervalUnit)}
              class="w-full h-11 px-3.5 rounded-input bg-surface border border-border-strong text-[15px] text-text focus:outline-none focus:border-signal transition-colors duration-[160ms]"
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
          <span class="text-[12.5px] font-medium text-muted mb-1.5 block">
            Start date
          </span>
          <input
            type="date"
            value={startDate()}
            onInput={(e) => setStartDate(e.currentTarget.value)}
            required
            class="w-full h-11 px-3.5 font-mono tabular rounded-input bg-surface border border-border-strong text-[15px] text-text focus:outline-none focus:border-signal transition-colors duration-[160ms]"
          />
        </label>
        <label class="block">
          <span class="text-[12.5px] font-medium text-muted mb-1.5 block">
            End date (optional)
          </span>
          <input
            type="date"
            value={endDate()}
            onInput={(e) => setEndDate(e.currentTarget.value)}
            class="w-full h-11 px-3.5 font-mono tabular rounded-input bg-surface border border-border-strong text-[15px] text-text focus:outline-none focus:border-signal transition-colors duration-[160ms]"
          />
        </label>
      </div>
      <Show when={error()}>
        <p role="alert" class="text-neg text-[13.5px]">{error()}</p>
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