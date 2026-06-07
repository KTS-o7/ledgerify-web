import { createResource, createSignal, For, Show, createMemo } from "solid-js";
import { api } from "../lib/api";
import { ShoppingCart, Coffee, Bus, Banknote, Receipt } from "lucide-solid";
import { formatDateGroup } from "../lib/format";
import { PageHeader } from "../components/ui/page-header";
import { SearchBar } from "../components/ui/search-bar";
import { TransactionRow } from "../components/ui/transaction-row";
import { SkeletonRow } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";

interface Tx {
  id: string;
  title: string;
  amount: string;
  type: "income" | "expense" | "transfer";
  date: string;
  category_name: string;
  account_name: string;
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
  const [search, setSearch] = createSignal("");
  const [txns] = createResource(() => api.get<Tx[]>("/v1/transactions"));

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
      <PageHeader title="Transactions" back />
      <div class="sticky top-14 md:top-16 z-20 bg-bg/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <SearchBar
          value={search()}
          onChange={setSearch}
          placeholder="Search by merchant, category, account…"
        />
      </div>
      <div class="p-4 md:p-6 md:max-w-3xl md:mx-auto">
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
                    />
                  )}
                </For>
              </div>
            </div>
          )}
        </For>
      </div>
    </>
  );
}
