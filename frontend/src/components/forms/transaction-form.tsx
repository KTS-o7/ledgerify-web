import { createSignal, createResource, createMemo, For, Show, type JSX } from "solid-js";
import { PenLine, Tag as TagIcon, Landmark, ArrowRight, Calendar, StickyNote, Delete, Repeat } from "lucide-solid";
import { api } from "../../lib/api";
import { Button } from "../ui/button";
import { SegmentedControl } from "../ui/segmented-control";
import { Eyebrow } from "../ui/eyebrow";
import { moneyParts } from "../ui/money";
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
  /** Starting type for a new transaction (quick-add from Income / Transfer). */
  initialType?: TxType;
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

  const [txType, setTxType] = createSignal<TxType>(props.existing?.type ?? props.initialType ?? "expense");
  const [amount, setAmount] = createSignal(props.existing?.amount != null ? String(props.existing.amount) : "");
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

  const typeOptions: { value: TxType; label: string; activeClass: string }[] = [
    { value: "expense", label: "Expense", activeClass: "text-text" },
    { value: "income", label: "Income", activeClass: "text-pos" },
    { value: "transfer", label: "Transfer", activeClass: "text-signal" },
  ];

  // The keypad replaces the system keyboard on phones; desktop types into the input.
  const useKeypad = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(max-width: 767px)").matches;

  /** Keep the amount a plain decimal: digits, one dot, two fraction digits. */
  function sanitizeAmount(raw: string): string {
    let v = raw.replace(/[^0-9.]/g, "");
    const dot = v.indexOf(".");
    if (dot >= 0) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, "").slice(0, 2);
    v = v.replace(/^0+(?=\d)/, "");
    return v.slice(0, 12);
  }
  function pressKey(k: string) {
    if (k === "back") setAmount((a) => a.slice(0, -1));
    else if (k === ".") setAmount((a) => (a.includes(".") ? a : sanitizeAmount((a || "0") + ".")));
    else setAmount((a) => sanitizeAmount(a + k));
  }
  const symbol = () => moneyParts(0, currency()).symbol;
  /** Group the integer part en-IN style while typing, keeping a trailing dot. */
  const displayAmount = () => {
    const a = amount();
    if (!a) return "0";
    const [int, frac] = a.split(".");
    const grouped = new Intl.NumberFormat("en-IN").format(Number(int || "0"));
    return frac !== undefined ? `${grouped}.${frac}` : grouped;
  };
  const keypad = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"];
  const submitLabel = () => (props.existing ? "Save changes" : `Save ${txType()}`);

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

  const row = "flex items-center gap-3 min-h-12 px-3.5 border-b border-border last:border-b-0";
  const bare = "flex-1 min-w-0 h-12 bg-transparent text-[14.5px] font-medium text-text placeholder:text-faint placeholder:font-normal focus:outline-none";
  const icon = (I: typeof PenLine) => <I size={16} class="text-muted shrink-0" aria-hidden="true" />;
  const field = (label: string, control: JSX.Element, I: typeof PenLine) => (
    <label class={row}>
      {icon(I)}
      <span class="sr-only">{label}</span>
      {control}
    </label>
  );
  const smallInput = "w-full h-10 px-3 rounded-[10px] bg-bg border border-border-strong text-text text-[14px] focus:outline-none focus:border-signal";

  return (
    <form onSubmit={handleSubmit} class="flex flex-col gap-4">
      <SegmentedControl
        options={typeOptions}
        value={txType()}
        onChange={setTxType}
        ariaLabel="Transaction type"
      />

      {/* Amount: a big mono display over a real input (screen readers and desktop typing). */}
      <div class="flex flex-col items-center gap-2.5 pt-2 pb-1">
        <div class="relative flex items-baseline justify-center gap-1.5 max-w-full rounded-[12px] px-3 focus-within:ring-2 focus-within:ring-signal">
          <span class="font-mono text-[30px] leading-none text-muted" aria-hidden="true">{symbol()}</span>
          <span class={cn("font-mono font-medium text-[60px] leading-none tracking-[-0.05em] tabular truncate", amount() ? "text-text" : "text-faint")} aria-hidden="true">
            {displayAmount()}
          </span>
          <span class="w-[2px] h-12 self-center bg-signal rounded-full animate-pulse motion-reduce:animate-none" aria-hidden="true" />
          <input
            id="tx-amount"
            type="text"
            inputmode={useKeypad ? "none" : "decimal"}
            autocomplete="off"
            aria-label={`Amount in ${currency()}`}
            value={amount()}
            onInput={(e) => { const v = sanitizeAmount(e.currentTarget.value); setAmount(v); e.currentTarget.value = v; }}
            class="absolute inset-0 w-full h-full opacity-0 cursor-text"
          />
        </div>
        <span class="inline-flex items-center h-7 px-2.5 rounded-pill border border-border-strong font-mono font-medium text-[12px] text-muted">
          {currency()}
        </span>
      </div>

      {/* Grouped fields */}
      <div class="flex flex-col rounded-[14px] border border-border bg-bg">
        {field("Description", (
          <input type="text" placeholder={txType() === "income" ? "Where from?" : "What was it?"} value={title()} onInput={(e) => setTitle(e.currentTarget.value)} class={bare} />
        ), PenLine)}
        {field("Category", (
          <select value={categoryId()} onChange={(e) => setCategoryId(e.currentTarget.value)} disabled={categories.loading} class={cn(bare, "appearance-none cursor-pointer", !categoryId() && "text-muted font-normal")}>
            <option value="">{categories.loading ? "Loading…" : "No category"}</option>
            <For each={filteredCategories()}>{(cat) => <option value={cat.id}>{cat.name}</option>}</For>
          </select>
        ), TagIcon)}
        {field(txType() === "transfer" ? "From account" : "Account", (
          <select value={accountId()} onChange={(e) => setAccountId(e.currentTarget.value)} disabled={accounts.loading} required class={cn(bare, "appearance-none cursor-pointer", !accountId() && "text-muted font-normal")}>
            <option value="">{accounts.loading ? "Loading…" : txType() === "transfer" ? "From account…" : "Select account…"}</option>
            <For each={accounts() ?? []}>{(acc) => <option value={acc.id}>{acc.name}</option>}</For>
          </select>
        ), Landmark)}
        <Show when={txType() === "transfer"}>
          {field("To account", (
            <select value={transferToId()} onChange={(e) => setTransferToId(e.currentTarget.value)} disabled={accounts.loading} required class={cn(bare, "appearance-none cursor-pointer", !transferToId() && "text-muted font-normal")}>
              <option value="">{accounts.loading ? "Loading…" : "To account…"}</option>
              <For each={(accounts() ?? []).filter((acc) => acc.id !== accountId())}>{(acc) => <option value={acc.id}>{acc.name}</option>}</For>
            </select>
          ), ArrowRight)}
        </Show>
        {field("Date", (
          <input type="date" value={date()} onInput={(e) => setDate(e.currentTarget.value)} required class={cn(bare, "font-mono tabular")} />
        ), Calendar)}
        {field("Note", (
          <input type="text" placeholder="Note (optional)" value={note()} onInput={(e) => setNote(e.currentTarget.value)} class={bare} />
        ), StickyNote)}
      </div>

      {/* Tags */}
      <Show when={(availableTags() ?? []).length > 0}>
        <div class="flex flex-wrap gap-1.5" role="group" aria-label="Tags">
          <For each={availableTags()}>
            {(tag) => {
              const on = () => selectedTagIds().includes(tag.id);
              return (
                <button
                  type="button"
                  aria-pressed={on()}
                  onClick={() => setSelectedTagIds((ids) => (on() ? ids.filter((i) => i !== tag.id) : [...ids, tag.id]))}
                  class={cn("h-7 px-3 rounded-pill text-[12.5px] font-medium transition-colors duration-[160ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal",
                    on() ? "bg-signal-soft text-signal" : "border border-border-strong text-muted hover:text-text")}
                >
                  #{tag.name}
                </button>
              );
            }}
          </For>
        </div>
      </Show>

      {/* Keypad (phones) */}
      <Show when={useKeypad}>
        <div class="grid grid-cols-3 gap-1.5 md:hidden" role="group" aria-label="Amount keypad">
          <For each={keypad}>
            {(k) => (
              <button
                type="button"
                onClick={() => pressKey(k)}
                aria-label={k === "back" ? "Delete digit" : k === "." ? "Decimal point" : k}
                class="h-12 rounded-[12px] flex items-center justify-center font-mono font-medium text-[24px] text-text active:bg-raised transition-colors duration-[90ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
              >
                <Show when={k === "back"} fallback={k}><Delete size={22} /></Show>
              </button>
            )}
          </For>
        </div>
      </Show>

      {/* Recurring */}
      <div class="rounded-[14px] border border-border">
        <label class="flex items-center gap-3 min-h-12 px-3.5 cursor-pointer">
          <Repeat size={16} class="text-muted shrink-0" aria-hidden="true" />
          <span class="flex-1 text-[14.5px] font-medium text-text">Repeat this</span>
          <input type="checkbox" role="switch" checked={makeRecurring()} onChange={(e) => setMakeRecurring(e.currentTarget.checked)} class="peer sr-only" />
          <span aria-hidden="true" class="relative w-9 h-5 rounded-pill bg-sunken border border-border-strong transition-colors duration-[160ms] peer-checked:bg-signal peer-focus-visible:ring-2 peer-focus-visible:ring-signal after:absolute after:top-0.5 after:left-0.5 after:w-3.5 after:h-3.5 after:rounded-full after:bg-text after:transition-transform after:duration-[160ms] peer-checked:after:translate-x-4 peer-checked:after:bg-btn-text" />
        </label>
        <Show when={makeRecurring()}>
          <div class="flex flex-col gap-3 px-3.5 pb-3.5 pt-1 border-t border-border">
            <label class="flex flex-col gap-1.5 pt-2">
              <Eyebrow>Frequency</Eyebrow>
              <select value={recFrequency()} onChange={(e) => setRecFrequency(e.currentTarget.value as "weekly" | "monthly" | "custom")} class={smallInput}>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <Show when={recFrequency() === "custom"}>
              <div class="grid grid-cols-2 gap-2">
                <label class="flex flex-col gap-1.5">
                  <Eyebrow>Every N</Eyebrow>
                  <input type="number" min="1" value={recIntervalValue()} onInput={(e) => setRecIntervalValue(e.currentTarget.value)} class={cn(smallInput, "font-mono tabular")} />
                </label>
                <label class="flex flex-col gap-1.5">
                  <Eyebrow>Unit</Eyebrow>
                  <select value={recIntervalUnit()} onChange={(e) => setRecIntervalUnit(e.currentTarget.value as "day" | "week" | "month")} class={smallInput}>
                    <option value="day">Days</option>
                    <option value="week">Weeks</option>
                    <option value="month">Months</option>
                  </select>
                </label>
              </div>
            </Show>
            <div class="grid grid-cols-2 gap-2">
              <label class="flex flex-col gap-1.5">
                <Eyebrow>Starts</Eyebrow>
                <input type="date" value={recStartDate()} onInput={(e) => setRecStartDate(e.currentTarget.value)} class={cn(smallInput, "font-mono tabular")} />
              </label>
              <label class="flex flex-col gap-1.5">
                <Eyebrow>Ends (optional)</Eyebrow>
                <input type="date" value={recEndDate()} onInput={(e) => setRecEndDate(e.currentTarget.value)} class={cn(smallInput, "font-mono tabular")} />
              </label>
            </div>
          </div>
        </Show>
      </div>

      {/* Error */}
      <Show when={error()}>
        <p class="text-neg text-[13.5px]" role="alert">{error()}</p>
      </Show>

      <Button type="submit" size="lg" class="w-full" disabled={submitting()}>
        {submitting() ? "Saving…" : submitLabel()}
      </Button>
    </form>
  );
}
