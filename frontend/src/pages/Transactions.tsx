import { createResource, createSignal, For, Show, createMemo } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import { api } from "../lib/api";
import { ShoppingCart, Coffee, Bus, Banknote, Receipt, Plus, X } from "lucide-solid";
import { formatDateGroup } from "../lib/format";
import { PageHeader } from "../components/ui/page-header";
import { SearchBar } from "../components/ui/search-bar";
import { TransactionRow } from "../components/ui/transaction-row";
import { SkeletonRow } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";
import { Sheet } from "../components/ui/sheet";
import { TransactionForm } from "../components/forms/transaction-form";

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
}

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
  const [txns, { refetch }] = createResource(
    () => ({ lim: limit(), accountId: accountIdFilter() }),
    ({ lim, accountId }) => api.get<Tx[]>(`/v1/transactions?limit=${lim}${accountId ? `&account_id=${accountId}` : ""}`)
  );
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
      <div class="sticky top-14 md:top-16 z-20 bg-bg/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <Show when={accountNameFilter()}>
          <div class="pb-2 flex items-center gap-2">
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
            title={search() ? "No matches" : "No transactions yet"}
            body={search() ? `Nothing matches "${search()}".` : "Add your first transaction to see it here."}
          />
        </Show>
        <For each={groups()}>
          {([date, items]) => (
            <div class="mb-4">
              <div class="sticky top-[124px] md:top-[136px] z-10 bg-bg/95 backdrop-blur-sm py-2">
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
