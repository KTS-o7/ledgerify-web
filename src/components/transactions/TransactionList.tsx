"use client";

import { useMemo, useState, useTransition } from "react";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CircleDollarSign,
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AmountBox,
  EmptyState,
  IconBadge,
  StatusPill,
  TonalWidget,
} from "@/components/shared/quiet-ledger";

interface Props {
  transactions: Transaction[];
  accounts: Array<{ id: string; name: string; currency: string }>;
  categories: Array<{
    id: string;
    name: string;
    type: "income" | "expense";
    color?: string | null;
  }>;
}

type TransactionFilter = "all" | Transaction["type"];

const BASE_FILTERS: Array<{ value: TransactionFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "expense", label: "Expenses" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfers" },
];

function DeleteButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(() => {
      deleteTransaction(id);
    });
  }

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label="Delete transaction"
          />
        }
      >
        <Trash2 className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete transaction?</DialogTitle>
          <DialogDescription>
            This transaction will be permanently removed. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

function getSignedAmount(transaction: Transaction) {
  return transaction.type === "expense"
    ? -Number(transaction.amount)
    : Number(transaction.amount);
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

  const hasTransfers = useMemo(
    () => transactions.some((t) => t.type === "transfer"),
    [transactions],
  );

  const filters = useMemo(
    () =>
      hasTransfers
        ? BASE_FILTERS
        : BASE_FILTERS.filter((f) => f.value !== "transfer"),
    [hasTransfers],
  );

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

  const summary = useMemo(() => {
    return filteredTransactions.reduce(
      (totals, transaction) => {
        const amount = Number(transaction.amount);

        if (transaction.type === "income") {
          totals.income += amount;
          totals.incomeCount += 1;
        }

        if (transaction.type === "expense") {
          totals.expense += amount;
          totals.expenseCount += 1;
        }

        if (transaction.type === "transfer") {
          totals.transfer += amount;
          totals.transferCount += 1;
        }

        return totals;
      },
      {
        income: 0,
        expense: 0,
        transfer: 0,
        incomeCount: 0,
        expenseCount: 0,
        transferCount: 0,
      },
    );
  }, [filteredTransactions]);

  const summaryCurrency =
    filteredTransactions[0]?.currency ?? accounts[0]?.currency ?? "INR";

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
      <div className="grid gap-3 md:grid-cols-3">
        <AmountBox
          label="Income"
          amount={summary.income}
          currency={summaryCurrency}
          icon={ArrowUpRight}
          tone="positive"
          count={`${summary.incomeCount} entries in view`}
        />
        <AmountBox
          label="Expenses"
          amount={summary.expense}
          currency={summaryCurrency}
          icon={ArrowDownLeft}
          tone="negative"
          count={`${summary.expenseCount} entries in view`}
        />
        {hasTransfers && (
          <AmountBox
            label="Transfers"
            amount={summary.transfer}
            currency={summaryCurrency}
            icon={ArrowLeftRight}
            tone="info"
            count={`${summary.transferCount} entries in view`}
          />
        )}
      </div>

      <TonalWidget tone="primary" className="p-3 sm:p-3">
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
      </TonalWidget>

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
                <h2 className="text-sm font-semibold">{group.label}</h2>
                <span className="text-xs text-muted-foreground">
                  {format(parseISO(group.date), "MMM d, yyyy")}
                </span>
              </div>

              <TonalWidget tone="neutral" className="space-y-2 p-3 sm:p-3">
                {group.items.map((transaction, index) => {
                  const Icon = getTransactionIcon(transaction.type);
                  const tone = getTransactionTone(transaction.type);
                  const signedAmount = getSignedAmount(transaction);
                  const account = accountMap.get(transaction.accountId);
                  const category = transaction.categoryId
                    ? categoryMap.get(transaction.categoryId)
                    : null;

                  return (
                    <div
                      key={transaction.id}
                      className={cn(
                        "group flex items-center justify-between gap-3 rounded-[1.5rem] border bg-background/70 p-3 shadow-sm shadow-foreground/5 transition hover:bg-background sm:p-4",
                        index === 0 && "border-primary/20",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="relative">
                          <IconBadge
                            icon={Icon}
                            tone={tone}
                            className="size-12 rounded-[1.35rem]"
                          />
                          {category?.color && (
                            <span
                              className="absolute -bottom-1 -right-1 size-4 rounded-full border-2 border-background"
                              style={{ backgroundColor: category.color }}
                            />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {transaction.note || "Untitled transaction"}
                            </p>
                            {!category && (
                              <CircleDollarSign className="size-3.5 shrink-0 text-muted-foreground" />
                            )}
                          </div>
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
              </TonalWidget>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
