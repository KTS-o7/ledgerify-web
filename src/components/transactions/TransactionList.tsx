"use client";

import { useMemo, useState, useTransition } from "react";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Search,
  Trash2,
  WalletCards,
} from "lucide-react";

import { deleteTransaction } from "@/app/actions/transactions";
import type { Transaction } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, StatusPill } from "@/components/shared/quiet-ledger";

interface Props {
  transactions: Transaction[];
  accounts: Array<{ id: string; name: string; currency: string }>;
  categories: Array<{ id: string; name: string; type: "income" | "expense" }>;
}

type TransactionFilter = "all" | Transaction["type"];

const filters: Array<{ value: TransactionFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "expense", label: "Expenses" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfers" },
];

function DeleteButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={isPending}
      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      aria-label="Delete transaction"
      onClick={() =>
        startTransition(() => {
          deleteTransaction(id);
        })
      }
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}

function getTransactionTone(type: Transaction["type"]) {
  if (type === "income") return "positive";
  if (type === "expense") return "negative";
  return "info";
}

function getTransactionIcon(type: Transaction["type"]) {
  if (type === "income") return ArrowUpRight;
  if (type === "expense") return ArrowDownLeft;
  return ArrowLeftRight;
}

function getDateLabel(date: string) {
  const parsed = parseISO(date);

  if (isToday(parsed)) return "Today";
  if (isYesterday(parsed)) return "Yesterday";

  return format(parsed, "EEEE, MMM d");
}

function groupTransactionsByDate(transactions: Transaction[]) {
  return transactions.reduce<
    Array<{ date: string; label: string; items: Transaction[] }>
  >((groups, transaction) => {
    const existing = groups.find((group) => group.date === transaction.date);

    if (existing) {
      existing.items.push(transaction);
      return groups;
    }

    groups.push({
      date: transaction.date,
      label: getDateLabel(transaction.date),
      items: [transaction],
    });

    return groups;
  }, []);
}

export function TransactionList({ transactions, accounts, categories }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TransactionFilter>("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const accountMap = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );
  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const filteredTransactions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return transactions.filter((transaction) => {
      const matchesFilter = filter === "all" || transaction.type === filter;
      const matchesAccount =
        accountFilter === "all" || transaction.accountId === accountFilter;
      const matchesCategory =
        categoryFilter === "all" || transaction.categoryId === categoryFilter;
      const account = accountMap.get(transaction.accountId);
      const category = transaction.categoryId
        ? categoryMap.get(transaction.categoryId)
        : null;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        transaction.note?.toLowerCase().includes(normalizedQuery) ||
        transaction.currency.toLowerCase().includes(normalizedQuery) ||
        account?.name.toLowerCase().includes(normalizedQuery) ||
        category?.name.toLowerCase().includes(normalizedQuery) ||
        transaction.date.includes(normalizedQuery) ||
        String(transaction.amount).includes(normalizedQuery);

      return matchesFilter && matchesAccount && matchesCategory && matchesQuery;
    });
  }, [accountFilter, accountMap, categoryFilter, categoryMap, filter, query, transactions]);

  const groupedTransactions = useMemo(
    () => groupTransactionsByDate(filteredTransactions),
    [filteredTransactions],
  );

  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={WalletCards}
        title="No transactions yet"
        description="Add your first income, expense, or transfer to start building your private money history."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border bg-card/85 p-3 shadow-sm shadow-foreground/5 backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search notes, dates, amounts…"
              className="h-11 rounded-2xl pl-9"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
            {filters.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition",
                  filter === item.value
                    ? "border-primary/20 bg-primary/10 text-primary"
                    : "border-border bg-background/70 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <select
            value={accountFilter}
            onChange={(event) => setAccountFilter(event.target.value)}
            className="h-10 rounded-2xl border border-input bg-background/70 px-3 text-sm text-foreground shadow-sm"
            aria-label="Filter by account"
          >
            <option value="all">All accounts</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="h-10 rounded-2xl border border-input bg-background/70 px-3 text-sm text-foreground shadow-sm"
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {groupedTransactions.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching transactions"
          description="Try a different search term or clear the selected filter."
          className="py-10"
        />
      ) : (
        <div className="space-y-6">
          {groupedTransactions.map((group) => (
            <section key={group.date} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold tracking-tight">
                  {group.label}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {format(parseISO(group.date), "MMM d, yyyy")}
                </span>
              </div>

              <div className="overflow-hidden rounded-3xl border bg-card/85 shadow-sm shadow-foreground/5 backdrop-blur">
                {group.items.map((transaction, index) => {
                  const Icon = getTransactionIcon(transaction.type);
                  const tone = getTransactionTone(transaction.type);
                  const signedAmount =
                    transaction.type === "expense"
                      ? -Number(transaction.amount)
                      : Number(transaction.amount);
                  const account = accountMap.get(transaction.accountId);
                  const category = transaction.categoryId
                    ? categoryMap.get(transaction.categoryId)
                    : null;

                  return (
                    <div
                      key={transaction.id}
                      className={cn(
                        "group flex items-center justify-between gap-3 p-3 transition hover:bg-muted/40 sm:p-4",
                        index > 0 && "border-t",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={cn(
                            "flex size-11 shrink-0 items-center justify-center rounded-2xl border",
                            tone === "positive" &&
                              "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
                            tone === "negative" &&
                              "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300",
                            tone === "info" &&
                              "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300",
                          )}
                        >
                          <Icon className="size-5" />
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {transaction.note || "Untitled transaction"}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <StatusPill tone={tone}>
                              {transaction.type}
                            </StatusPill>
                            <span className="text-xs text-muted-foreground">
                              {[category?.name, account?.name, transaction.currency]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <div className="text-right">
                          <p
                            className={cn(
                              "text-sm font-bold tabular-nums sm:text-base",
                              transaction.type === "income" &&
                                "text-emerald-700 dark:text-emerald-300",
                              transaction.type === "expense" &&
                                "text-rose-700 dark:text-rose-300",
                            )}
                          >
                            {signedAmount > 0 ? "+" : ""}
                            {formatCurrency(signedAmount, transaction.currency)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {transaction.date}
                          </p>
                        </div>
                        <div className="opacity-60 transition group-hover:opacity-100">
                          <DeleteButton id={transaction.id} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
