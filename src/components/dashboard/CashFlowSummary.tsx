"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
  WalletCards,
} from "lucide-react";

import type { Transaction } from "@/lib/db/schema";
import {
  FinancialAmount,
  IconBadge,
  ProgressMeter,
  StatusPill,
} from "@/components/shared/quiet-ledger";

interface Props {
  transactions: Transaction[];
  currency: string;
}

export function CashFlowSummary({ transactions, currency }: Props) {
  const income = transactions
    .filter((transaction) => transaction.type === "income")
    .reduce(
      (sum, transaction) =>
        sum + Number(transaction.convertedAmount ?? transaction.amount),
      0,
    );

  const expense = transactions
    .filter((transaction) => transaction.type === "expense")
    .reduce(
      (sum, transaction) =>
        sum + Number(transaction.convertedAmount ?? transaction.amount),
      0,
    );

  const net = income - expense;
  const transactionCount = transactions.length;
  const expensePace = income > 0 ? Math.min((expense / income) * 100, 100) : 0;
  const netTone = net > 0 ? "positive" : net < 0 ? "negative" : "neutral";

  return (
    <section className="rounded-[2rem] border bg-card/85 p-5 shadow-sm shadow-foreground/5 backdrop-blur sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <IconBadge icon={WalletCards} tone="primary" className="size-10" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Month in motion
              </p>
              <h2 className="text-xl font-bold tracking-tight">Cash flow</h2>
            </div>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            A simple view of money coming in, money going out, and whether this
            month is staying healthy.
          </p>
        </div>

        <StatusPill tone={netTone}>
          {net > 0
            ? "Ahead this month"
            : net < 0
              ? "Spending ahead"
              : "Balanced"}
        </StatusPill>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-3xl border bg-background/70 p-4">
          <div className="flex items-center gap-3">
            <IconBadge
              icon={ArrowUpRight}
              tone="positive"
              className="size-10"
            />
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Income
              </p>
              <p className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-300">
                <FinancialAmount amount={income} currency={currency} />
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border bg-background/70 p-4">
          <div className="flex items-center gap-3">
            <IconBadge
              icon={ArrowDownLeft}
              tone="negative"
              className="size-10"
            />
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Expenses
              </p>
              <p className="mt-1 text-lg font-bold text-rose-700 dark:text-rose-300">
                <FinancialAmount amount={expense} currency={currency} />
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border bg-background/70 p-4">
          <div className="flex items-center gap-3">
            <IconBadge icon={Landmark} tone={netTone} className="size-10" />
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Net
              </p>
              <p className="mt-1 text-lg font-bold">
                <FinancialAmount
                  amount={net}
                  currency={currency}
                  sign="always"
                />
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-3xl border bg-background/70 p-4">
        <ProgressMeter
          value={expensePace}
          tone={expensePace > 85 ? "warning" : "positive"}
          label="Expense pace against income"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{transactionCount} transactions this month</span>
          <span>
            {income > 0
              ? `${Math.round(expensePace)}% of income spent`
              : "Add income to track spending pace"}
          </span>
        </div>
      </div>
    </section>
  );
}
