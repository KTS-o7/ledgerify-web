import { createResource, createSignal, For, Show, createMemo, createEffect, on, onCleanup } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import { api } from "../lib/api";
import {
  ShoppingCart, Coffee, Bus, Banknote, Receipt, X, SlidersHorizontal, Utensils, Home, Zap,
  HeartPulse, Film, Plane, ShoppingBag, GraduationCap, ArrowLeftRight,
} from "lucide-solid";
import { formatDateGroup } from "../lib/format";
import { queued, queuedWrites } from "../lib/pwa";
import { onDataChanged, onRowEdit, onRowMove } from "../lib/events";
import { PageHeader } from "../components/ui/page-header";
import { SearchBar } from "../components/ui/search-bar";
import { TransactionRow } from "../components/ui/transaction-row";
import { SkeletonRow } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";
import { Sheet } from "../components/ui/sheet";
import { Money } from "../components/ui/money";
import { Eyebrow } from "../components/ui/eyebrow";
import { CATEGORY_PALETTE } from "../components/ui/donut-chart";
import { NewTransactionButton } from "../components/shell/NewTransactionButton";
import { TransactionForm } from "../components/forms/transaction-form";
import { PullToRefresh } from "../components/activity/PullToRefresh";
import { cn } from "../lib/utils";

interface Tx {
  id: string;
  title: string | null;
  amount: string | number;
  currency?: string;
  type: "income" | "expense" | "transfer";
  date: string;
  category_name: string | null;
  account_name: string;
  parent_recurring_id?: string | null;
}

interface FullTx {
  id: string;
  account_id: string;
  type: "income" | "expense" | "transfer";
  amount: string;
  currency: string;
  date: string;
  category_id: string | null;
  title: string;
  note: string;
  transfer_to_id?: string | null;
  tags?: { id: string; name: string; color: string }[];
}

interface Category {
  id: string;
  name: string;
}

type TxType = "" | "income" | "expense" | "transfer";

function categoryIcon(category: string, type: Tx["type"]) {
  if (type === "transfer") return ArrowLeftRight;
  const c = (category || "").toLowerCase();
  if (c.includes("grocer")) return ShoppingCart;
  if (c.includes("coffee") || c.includes("cafe")) return Coffee;
  if (c.includes("dining") || c.includes("food") || c.includes("restaurant")) return Utensils;
  if (c.includes("transport") || c.includes("fuel") || c.includes("cab")) return Bus;
  if (c.includes("travel") || c.includes("flight")) return Plane;
  if (c.includes("rent") || c.includes("home") || c.includes("housing")) return Home;
  if (c.includes("util") || c.includes("bill") || c.includes("electric")) return Zap;
  if (c.includes("health") || c.includes("medical")) return HeartPulse;
  if (c.includes("entertain") || c.includes("movie")) return Film;
  if (c.includes("shop")) return ShoppingBag;
  if (c.includes("educat")) return GraduationCap;
  if (type === "income" || c.includes("income") || c.includes("salary")) return Banknote;
  return Receipt;
}

/** Stable category colour from the theme palette (cat-1..cat-6), so it adapts to light/dark. */
function categoryColor(name: string): string {
  if (!name) return "var(--color-muted)";
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return CATEGORY_PALETTE[Math.abs(h) % CATEGORY_PALETTE.length]!;
}

const toNumber = (v: string | number) => (typeof v === "number" ? v : parseFloat(v) || 0);

function groupByDate(items: Tx[]) {
  const map = new Map<string, Tx[]>();
  for (const t of items) {
    if (!map.has(t.date)) map.set(t.date, []);
    map.get(t.date)!.push(t);
  }
  return Array.from(map.entries()).sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0));
}

/** Net of a day: income in, expenses out, transfers neutral. */
function dayNet(items: Tx[]) {
  return items.reduce((sum, t) => sum + (t.type === "income" ? 1 : t.type === "expense" ? -1 : 0) * toNumber(t.amount), 0);
}

const TYPE_CHIPS: { value: TxType; label: string }[] = [
  { value: "", label: "All" },
  { value: "income", label: "Income" },
  { value: "expense", label: "Expense" },
  { value: "transfer", label: "Transfer" },
];

const dateInput = "h-9 w-full rounded-[10px] border border-border-strong bg-surface px-2.5 text-[13.5px] text-text font-mono tabular focus:outline-none focus:border-signal";

export default function Transactions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const accountIdFilter = () => { const v = searchParams.account_id; return Array.isArray(v) ? (v[0] ?? "") : (v ?? ""); };
  const accountNameFilter = () => { const v = searchParams.account_name; const raw = Array.isArray(v) ? (v[0] ?? "") : (v ?? ""); return raw ? decodeURIComponent(raw) : ""; };

  const [search, setSearch] = createSignal("");
  const [limit, setLimit] = createSignal(50);
  const [loadingMore, setLoadingMore] = createSignal(false);
  const [filtersOpen, setFiltersOpen] = createSignal(false);

  // Filter signals
  const [fromDate, setFromDate] = createSignal("");
  const [toDate, setToDate] = createSignal("");
  const [typeFilter, setTypeFilter] = createSignal<TxType>("");
  const [categoryId, setCategoryId] = createSignal("");

  // Build query string for reactive resource
  const queryKey = createMemo(() => ({
    lim: limit(),
    accountId: accountIdFilter(),
    from: fromDate(),
    to: toDate(),
    type: typeFilter(),
    catId: categoryId(),
  }));

  const [txns, { refetch }] = createResource(
    queryKey,
    ({ lim, accountId, from, to, type, catId }) => {
      const params = new URLSearchParams();
      params.set("limit", String(lim));
      if (accountId) params.set("account_id", accountId);
      if (from) params.set("from_date", from);
      if (to) params.set("to_date", to);
      if (type) params.set("type", type);
      if (catId) params.set("category_id", catId);
      return api.get<Tx[]>(`/v1/transactions?${params.toString()}`);
    }
  );

  // Fetch categories for the filter dropdown
  const [categories] = createResource(() => api.get<Category[]>("/v1/categories"));

  // Writes queued offline by the service worker, shown as "Waiting to sync".
  const [pending] = createResource(
    () => queued(),
    async () => (await queuedWrites()).filter((w) => w.method === "POST" && /\/api\/v1\/transactions\/?$/.test(new URL(w.url, location.origin).pathname)),
  );

  const [editTx, setEditTx] = createSignal<FullTx | null>(null);
  const [editSheetOpen, setEditSheetOpen] = createSignal(false);

  async function openEdit(id: string) {
    try {
      const full = await api.get<FullTx>(`/v1/transactions/${id}`);
      setEditTx(full);
      setEditSheetOpen(true);
    } catch {
      alert("Failed to load transaction.");
    }
  }

  async function handleDelete(id: string, title: string | null) {
    if (!confirm(`Delete "${title || "this transaction"}"?`)) return;
    try {
      await api.delete(`/v1/transactions/${id}`);
      refetch();
    } catch {
      alert("Failed to delete transaction.");
    }
  }

  async function loadMore() {
    setLoadingMore(true);
    setLimit((l) => l + 50);
    await new Promise<void>((resolve) => {
      const check = () => {
        if (!txns.loading) resolve();
        else setTimeout(check, 50);
      };
      check();
    });
    setLoadingMore(false);
  }

  function resetFilters() {
    setFromDate("");
    setToDate("");
    setTypeFilter("");
    setCategoryId("");
    setLimit(50);
  }

  // Type chips live outside the panel, so they don't count as "advanced" filters.
  const hasPanelFilters = createMemo(() => fromDate() !== "" || toDate() !== "" || categoryId() !== "");
  const hasActiveFilters = createMemo(() => hasPanelFilters() || typeFilter() !== "");

  const filtered = createMemo(() => {
    const list = txns() ?? [];
    const q = search().toLowerCase().trim();
    if (!q) return list;
    return list.filter((t) =>
      (t.title || "").toLowerCase().includes(q) ||
      (t.category_name || "").toLowerCase().includes(q) ||
      (t.account_name || "").toLowerCase().includes(q)
    );
  });

  const groups = createMemo(() => groupByDate(filtered()));
  const flatRows = createMemo(() => groups().flatMap(([, items]) => items));

  // ---------- New-row glow after a quick-add ----------
  const [glowIds, setGlowIds] = createSignal<Set<string>>(new Set());
  let beforeIds: Set<string> | null = null;
  let glowTimer: ReturnType<typeof setTimeout> | undefined;
  onDataChanged(() => {
    beforeIds = new Set((txns() ?? []).map((t) => t.id));
    refetch();
  });
  createEffect(on(() => txns(), (list) => {
    if (!beforeIds || txns.loading || !list) return;
    const fresh = new Set(list.filter((t) => !beforeIds!.has(t.id)).map((t) => t.id));
    beforeIds = null;
    setGlowIds(fresh);
    clearTimeout(glowTimer);
    glowTimer = setTimeout(() => setGlowIds(new Set<string>()), 1400);
  }));
  onCleanup(() => clearTimeout(glowTimer));

  // ---------- J / K selection, E edit ----------
  const [selectedId, setSelectedId] = createSignal<string | null>(null);
  onRowMove((delta) => {
    const rows = flatRows();
    if (rows.length === 0) return;
    const i = rows.findIndex((r) => r.id === selectedId());
    const next = i < 0 ? (delta > 0 ? 0 : rows.length - 1) : Math.max(0, Math.min(rows.length - 1, i + delta));
    const id = rows[next]!.id;
    setSelectedId(id);
    document.querySelector(`[data-tx-id="${id}"]`)?.scrollIntoView({ block: "nearest", behavior: "auto" });
  });
  onRowEdit(() => { const id = selectedId(); if (id) openEdit(id); });

  const refresh = () => Promise.resolve(refetch());
  const showSkeleton = () => txns.loading && !txns.latest;

  return (
    <>
      <PageHeader
        title="Activity"
        meta={<Show when={txns.latest}>{filtered().length}</Show>}
        actions={<NewTransactionButton />}
      />

      <div class="px-5 md:px-7 pt-4 pb-3 flex flex-col gap-3 border-b border-border">
        {/* Account filter badge */}
        <Show when={accountNameFilter()}>
          <div class="flex items-center gap-2">
            <span class="text-[12.5px] text-muted">Account</span>
            <span class="inline-flex items-center gap-1.5 h-7 pl-3 pr-1.5 rounded-pill bg-raised text-[13px] font-medium text-text">
              {accountNameFilter()}
              <button
                type="button"
                onClick={() => setSearchParams({ account_id: undefined, account_name: undefined })}
                aria-label="Clear account filter"
                class="w-5 h-5 flex items-center justify-center rounded-full text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
              >
                <X size={12} />
              </button>
            </span>
          </div>
        </Show>

        <SearchBar
          value={search()}
          onChange={setSearch}
          placeholder="Merchant, category, account"
          class="md:max-w-[520px]"
          trailing={
            <button
              type="button"
              onClick={() => setFiltersOpen((o) => !o)}
              aria-label="Filters"
              aria-expanded={filtersOpen()}
              aria-controls="activity-filters"
              class="relative mr-1 w-9 h-9 flex items-center justify-center rounded-[9px] text-text hover:bg-raised transition-colors duration-[160ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
            >
              <SlidersHorizontal size={16} />
              <Show when={hasPanelFilters()}>
                <span class="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-signal" aria-hidden="true" />
              </Show>
            </button>
          }
        />

        {/* Type chips */}
        <div class="flex items-center gap-1.5 overflow-x-auto scrollbar-none" role="group" aria-label="Transaction type">
          <For each={TYPE_CHIPS}>
            {(chip) => (
              <button
                type="button"
                aria-pressed={typeFilter() === chip.value}
                onClick={() => { setTypeFilter(chip.value); setLimit(50); }}
                class={cn(
                  "h-8 px-3.5 shrink-0 rounded-pill text-[13px] transition-colors duration-[160ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal",
                  typeFilter() === chip.value
                    ? "bg-text text-bg font-semibold"
                    : "border border-border-strong text-muted font-medium hover:text-text"
                )}
              >
                {chip.label}
              </button>
            )}
          </For>
        </div>

        {/* Date range + category */}
        <Show when={filtersOpen() || hasPanelFilters()}>
          <div id="activity-filters" class="grid grid-cols-2 md:flex md:items-end gap-2">
            <label class="flex flex-col gap-1.5 min-w-0">
              <Eyebrow>From</Eyebrow>
              <div class="relative flex items-center">
                <input type="date" value={fromDate()} onInput={(e) => { setFromDate(e.currentTarget.value); setLimit(50); }} class={cn(dateInput, "pr-7")} />
                <Show when={fromDate()}>
                  <button type="button" onClick={() => { setFromDate(""); setLimit(50); }} class="absolute right-1.5 text-muted hover:text-text" aria-label="Clear from date">
                    <X size={12} />
                  </button>
                </Show>
              </div>
            </label>
            <label class="flex flex-col gap-1.5 min-w-0">
              <Eyebrow>To</Eyebrow>
              <div class="relative flex items-center">
                <input type="date" value={toDate()} onInput={(e) => { setToDate(e.currentTarget.value); setLimit(50); }} class={cn(dateInput, "pr-7")} />
                <Show when={toDate()}>
                  <button type="button" onClick={() => { setToDate(""); setLimit(50); }} class="absolute right-1.5 text-muted hover:text-text" aria-label="Clear to date">
                    <X size={12} />
                  </button>
                </Show>
              </div>
            </label>
            <label class="flex flex-col gap-1.5 min-w-0 col-span-2 md:col-span-1 md:min-w-[180px]">
              <Eyebrow>Category</Eyebrow>
              <select
                value={categoryId()}
                onChange={(e) => { setCategoryId(e.currentTarget.value); setLimit(50); }}
                class="h-9 rounded-[10px] border border-border-strong bg-surface px-2.5 text-[13.5px] text-text focus:outline-none focus:border-signal"
              >
                <option value="">All categories</option>
                <For each={categories() ?? []}>
                  {(cat) => <option value={cat.id}>{cat.name}</option>}
                </For>
              </select>
            </label>
            <Show when={hasActiveFilters()}>
              <button
                type="button"
                onClick={resetFilters}
                class="col-span-2 md:col-span-1 h-9 px-3 rounded-[10px] border border-border-strong text-[13px] font-medium text-muted hover:text-text transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
              >
                <X size={12} />
                Clear filters
              </button>
            </Show>
          </div>
        </Show>
      </div>

      <PullToRefresh onRefresh={refresh}>
        <div class="px-5 md:px-7 pb-6 md:max-w-[880px]">
          <Show when={search() && txns.latest}>
            <p class="text-[12.5px] text-muted pt-3">
              <span class="font-mono tabular">{filtered().length}</span> of <span class="font-mono tabular">{txns()?.length ?? 0}</span> match “{search()}”
            </p>
          </Show>

          {/* Queued offline writes */}
          <Show when={(pending() ?? []).length > 0}>
            <section aria-label="Waiting to sync">
              <div class="flex justify-between pt-4 pb-1">
                <Eyebrow class="text-warn">Waiting to sync</Eyebrow>
                <span class="font-mono text-[11px] text-muted tabular">{(pending() ?? []).length}</span>
              </div>
              <For each={pending()}>
                {(w) => {
                  const b = w.body ?? {};
                  const type = (b.type as Tx["type"]) ?? "expense";
                  return (
                    <div class="border-b border-border">
                      <TransactionRow
                        icon={categoryIcon("", type)}
                        merchant={(b.title as string) || (b.note as string) || "New transaction"}
                        category=""
                        amount={Number(b.amount) || 0}
                        currency={(b.currency as string) || undefined}
                        type={type}
                        date={(b.date as string) || new Date(w.at).toISOString().slice(0, 10)}
                        pending
                      />
                    </div>
                  );
                }}
              </For>
            </section>
          </Show>

          <Show when={showSkeleton()}>
            <div class="flex flex-col gap-1 pt-4">
              <For each={[0, 1, 2, 3, 4, 5]}>{() => <SkeletonRow />}</For>
            </div>
          </Show>
          <Show when={txns.error}>
            <p class="text-neg text-[14px] py-6 text-center">Failed to load transactions.</p>
          </Show>
          <Show when={!txns.loading && !txns.error && filtered().length === 0 && (pending() ?? []).length === 0}>
            <EmptyState
              icon={Receipt}
              title={search() ? "No matches" : hasActiveFilters() ? "Nothing here" : "No transactions yet"}
              body={search() ? `Nothing matches “${search()}”.` : hasActiveFilters() ? "Try adjusting or clearing your filters." : "Press N or the + button to add your first one."}
            />
          </Show>

          <For each={groups()}>
            {([date, items]) => (
              <section aria-label={formatDateGroup(date)}>
                <div class="sticky top-[calc(60px+env(safe-area-inset-top))] md:top-[68px] z-10 -mx-5 md:-mx-7 px-5 md:px-7 bg-bg flex justify-between items-baseline pt-4 pb-1.5">
                  <Eyebrow as="h2">{formatDateGroup(date)}</Eyebrow>
                  <Money value={dayNet(items)} signed tone="muted" class="text-[11px]" />
                </div>
                <div class="flex flex-col">
                  <For each={items}>
                    {(tx) => (
                      <div
                        data-tx-id={tx.id}
                        class={cn("border-b border-border overflow-hidden", glowIds().has(tx.id) && "animate-row-in motion-reduce:animate-none")}
                      >
                        <TransactionRow
                          icon={categoryIcon(tx.category_name ?? "", tx.type)}
                          color={categoryColor(tx.category_name ?? "")}
                          merchant={tx.title || "—"}
                          category={[tx.category_name || "Uncategorized", tx.account_name].filter(Boolean).join(" · ")}
                          amount={toNumber(tx.amount)}
                          currency={tx.currency}
                          type={tx.type}
                          date={tx.date}
                          recurring={!!tx.parent_recurring_id}
                          selected={selectedId() === tx.id}
                          onClick={() => { setSelectedId(tx.id); openEdit(tx.id); }}
                          onEdit={() => openEdit(tx.id)}
                          onDelete={() => handleDelete(tx.id, tx.title)}
                        />
                      </div>
                    )}
                  </For>
                </div>
              </section>
            )}
          </For>

          {/* Load more */}
          <Show when={!txns.loading && (txns()?.length ?? 0) >= limit()}>
            <div class="flex justify-center pt-5 pb-2">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore()}
                class="h-10 px-5 rounded-[10px] border border-border-strong text-muted hover:text-text hover:bg-raised transition-colors duration-[160ms] text-[13.5px] font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
              >
                {loadingMore() ? "Loading…" : "Load more"}
              </button>
            </div>
          </Show>
        </div>
      </PullToRefresh>

      <Sheet open={editSheetOpen()} onClose={() => { setEditSheetOpen(false); setEditTx(null); }} title="Edit transaction">
        <Show when={editTx()}>
          {(tx) => (
            <TransactionForm
              existing={{
                id: tx().id,
                type: tx().type,
                amount: tx().amount,
                currency: tx().currency,
                date: tx().date,
                account_id: tx().account_id,
                category_id: tx().category_id ?? undefined,
                title: tx().title,
                note: tx().note,
                transfer_to_id: tx().transfer_to_id ?? undefined,
                tags: tx().tags ?? [],
              }}
              onSuccess={() => { setEditSheetOpen(false); setEditTx(null); refetch(); }}
              onClose={() => { setEditSheetOpen(false); setEditTx(null); }}
            />
          )}
        </Show>
      </Sheet>
    </>
  );
}
