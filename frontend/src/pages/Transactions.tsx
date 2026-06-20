import { createResource, createSignal, For, Show, createMemo } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import { api } from "../lib/api";
import { ShoppingCart, Coffee, Bus, Banknote, Receipt, Plus, X, SlidersHorizontal } from "lucide-solid";
import { formatDateGroup } from "../lib/format";
import { PageHeader } from "../components/ui/page-header";
import { SearchBar } from "../components/ui/search-bar";
import { TransactionRow } from "../components/ui/transaction-row";
import { SkeletonRow } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";
import { Sheet } from "../components/ui/sheet";
import { TransactionForm } from "../components/forms/transaction-form";
import { cn } from "../lib/utils";

interface Tx {
  id: string;
  title: string;
  amount: string;
  type: "income" | "expense" | "transfer";
  date: string;
  category_name: string;
  account_name: string;
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

function categoryIcon(category: string) {
  switch (category) {
    case "Groceries": return ShoppingCart;
    case "Dining": return Coffee;
    case "Transport": return Bus;
    case "Income": return Banknote;
    default: return Receipt;
  }
}

function groupByDate(items: Tx[]) {
  const map = new Map<string, Tx[]>();
  for (const t of items) {
    if (!map.has(t.date)) map.set(t.date, []);
    map.get(t.date)!.push(t);
  }
  return Array.from(map.entries()).sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0));
}

export default function Transactions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const accountIdFilter = () => { const v = searchParams.account_id; return Array.isArray(v) ? (v[0] ?? "") : (v ?? ""); };
  const accountNameFilter = () => { const v = searchParams.account_name; const raw = Array.isArray(v) ? (v[0] ?? "") : (v ?? ""); return raw ? decodeURIComponent(raw) : ""; };

  const [search, setSearch] = createSignal("");
  const [limit, setLimit] = createSignal(50);
  const [loadingMore, setLoadingMore] = createSignal(false);

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

  const [sheetOpen, setSheetOpen] = createSignal(false);
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

  async function handleDelete(id: string, title: string) {
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

  function resetDateFilters() {
    setFromDate("");
    setToDate("");
    setLimit(50);
  }

  const hasActiveFilters = createMemo(() =>
    fromDate() !== "" || toDate() !== "" || typeFilter() !== "" || categoryId() !== ""
  );

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

  const TYPE_CHIPS: { value: TxType; label: string }[] = [
    { value: "", label: "All" },
    { value: "income", label: "Income" },
    { value: "expense", label: "Expense" },
    { value: "transfer", label: "Transfer" },
  ];

  return (
    <>
      <PageHeader
        title="Transactions"
        back
        actions={
          <button type="button" aria-label="Add transaction"
            onClick={() => setSheetOpen(true)}
            class="w-10 h-10 flex items-center justify-center rounded-full bg-surface text-text active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg">
            <Plus size={20} />
          </button>
        }
      />
      <div class="sticky top-14 md:top-16 z-20 bg-bg/95 backdrop-blur-sm border-b border-border px-4 py-3 space-y-3">
        {/* Account filter badge */}
        <Show when={accountNameFilter()}>
          <div class="flex items-center gap-2">
            <span class="text-[13px] text-muted">Filtered by account:</span>
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface text-sm font-medium text-text border border-border">
              {accountNameFilter()}
              <button
                type="button"
                onClick={() => setSearchParams({ account_id: undefined, account_name: undefined })}
                aria-label="Clear account filter"
                class="text-muted hover:text-text transition-colors"
              >
                <X size={12} />
              </button>
            </span>
          </div>
        </Show>

        {/* Filter bar */}
        <div class="flex flex-col gap-2.5">
          {/* Type chips */}
          <div class="flex items-center gap-1.5 flex-wrap">
            <SlidersHorizontal size={14} class="text-muted shrink-0" />
            <For each={TYPE_CHIPS}>
              {(chip) => (
                <button
                  type="button"
                  onClick={() => { setTypeFilter(chip.value); setLimit(50); }}
                  class={cn(
                    "px-3 py-1 rounded-pill text-[13px] font-display font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
                    typeFilter() === chip.value
                      ? "bg-text text-bg"
                      : "bg-surface text-muted hover:text-text border border-border"
                  )}
                >
                  {chip.label}
                </button>
              )}
            </For>
          </div>

          {/* Date range + category */}
          <div class="flex items-end gap-2 flex-wrap">
            {/* From date */}
            <div class="flex flex-col gap-1 min-w-0">
              <label class="text-[11px] text-muted uppercase tracking-wide">From</label>
              <div class="relative flex items-center">
                <input
                  type="date"
                  value={fromDate()}
                  onInput={(e) => { setFromDate(e.currentTarget.value); setLimit(50); }}
                  class="h-8 rounded-input border border-border bg-surface px-2.5 text-sm text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary pr-7"
                />
                <Show when={fromDate()}>
                  <button
                    type="button"
                    onClick={() => { setFromDate(""); setLimit(50); }}
                    class="absolute right-1.5 text-muted hover:text-text"
                    aria-label="Clear from date"
                  >
                    <X size={12} />
                  </button>
                </Show>
              </div>
            </div>
            {/* To date */}
            <div class="flex flex-col gap-1 min-w-0">
              <label class="text-[11px] text-muted uppercase tracking-wide">To</label>
              <div class="relative flex items-center">
                <input
                  type="date"
                  value={toDate()}
                  onInput={(e) => { setToDate(e.currentTarget.value); setLimit(50); }}
                  class="h-8 rounded-input border border-border bg-surface px-2.5 text-sm text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary pr-7"
                />
                <Show when={toDate()}>
                  <button
                    type="button"
                    onClick={() => { setToDate(""); setLimit(50); }}
                    class="absolute right-1.5 text-muted hover:text-text"
                    aria-label="Clear to date"
                  >
                    <X size={12} />
                  </button>
                </Show>
              </div>
            </div>
            {/* Category select */}
            <div class="flex flex-col gap-1 min-w-0 flex-1">
              <label class="text-[11px] text-muted uppercase tracking-wide">Category</label>
              <select
                value={categoryId()}
                onChange={(e) => { setCategoryId(e.currentTarget.value); setLimit(50); }}
                class="h-8 rounded-input border border-border bg-surface px-2.5 text-sm text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary min-w-[130px]"
              >
                <option value="">All categories</option>
                <For each={categories() ?? []}>
                  {(cat) => <option value={cat.id}>{cat.name}</option>}
                </For>
              </select>
            </div>
            {/* Clear all filters */}
            <Show when={hasActiveFilters()}>
              <button
                type="button"
                onClick={resetFilters}
                class="h-8 px-3 rounded-input border border-border text-[13px] text-muted hover:text-text transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <X size={12} />
                Clear filters
              </button>
            </Show>
          </div>
        </div>

        <SearchBar
          value={search()}
          onChange={setSearch}
          placeholder="Search by merchant, category, account…"
        />
      </div>
      <div class="p-4 md:p-6">
        <Show when={!txns.loading && (txns()?.length ?? 0) > 0}>
          <p class="text-[13px] text-muted mb-3">
            Showing {filtered().length} of {txns()?.length ?? 0} transactions
            {search() ? " matching your search" : ""}
          </p>
        </Show>
        <Show when={txns.loading}>
          <div class="flex flex-col">
            <For each={[0, 1, 2, 3, 4]}>{() => <SkeletonRow class="mb-1" />}</For>
          </div>
        </Show>
        <Show when={txns.error}>
          <p class="text-accent text-sm py-6 text-center">Failed to load transactions.</p>
        </Show>
        <Show when={!txns.loading && !txns.error && filtered().length === 0}>
          <EmptyState
            icon={Receipt}
            title={search() ? "No matches" : hasActiveFilters() ? "No transactions match filters" : "No transactions yet"}
            body={search() ? `Nothing matches "${search()}".` : hasActiveFilters() ? "Try adjusting or clearing your filters." : "Add your first transaction to see it here."}
          />
        </Show>
        <For each={groups()}>
          {([date, items]) => (
            <div class="mb-4">
              <div class="sticky top-[220px] md:top-[232px] z-10 bg-bg/95 backdrop-blur-sm py-2">
                <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide">
                  {formatDateGroup(date)}
                </span>
              </div>
              <div class="flex flex-col">
                <For each={items}>
                  {(tx) => (
                    <TransactionRow
                      icon={categoryIcon(tx.category_name)}
                      merchant={tx.title || "—"}
                      category={tx.category_name || "Uncategorized"}
                      amount={parseFloat(tx.amount)}
                      type={tx.type}
                      date={tx.date}
                      onEdit={() => openEdit(tx.id)}
                      onDelete={() => handleDelete(tx.id, tx.title)}
                    />
                  )}
                </For>
              </div>
            </div>
          )}
        </For>
        {/* Load more */}
        <Show when={!txns.loading && (txns()?.length ?? 0) >= limit()}>
          <div class="flex justify-center pt-4 pb-2">
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore()}
              class="px-6 py-2.5 rounded-input border border-border text-muted hover:text-text hover:border-border-strong transition-colors text-sm font-medium disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              {loadingMore() ? "Loading…" : "Load more"}
            </button>
          </div>
        </Show>
      </div>

      <Sheet open={sheetOpen()} onClose={() => setSheetOpen(false)} title="Add Transaction">
        <TransactionForm
          onSuccess={() => { setSheetOpen(false); refetch(); }}
          onClose={() => setSheetOpen(false)}
        />
      </Sheet>

      <Sheet open={editSheetOpen()} onClose={() => { setEditSheetOpen(false); setEditTx(null); }} title="Edit Transaction">
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
