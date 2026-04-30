"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
  WalletCards,
} from "lucide-react";

import type { Transaction } from "@/lib/db/schema";
import {
  AmountBox,
  ProgressMeter,
  StatusPill,
  TonalWidget,
  WidgetHeading,
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
    <TonalWidget tone="cash" className="space-y-6">
      <WidgetHeading
        icon={WalletCards}
        tone="cash"
        eyebrow="Month in motion"
        title="Cash flow"
        description="Money coming in, money going out, and whether this month is staying healthy."
        action={
          <StatusPill tone={netTone}>
            {net > 0
              ? "Ahead this month"
              : net < 0
                ? "Spending ahead"
                : "Balanced"}
          </StatusPill>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <AmountBox
          label="Income"
          amount={income}
          currency={currency}
          icon={ArrowUpRight}
          tone="positive"
          count="Money received this month"
        />
        <AmountBox
          label="Expenses"
          amount={expense}
          currency={currency}
          icon={ArrowDownLeft}
          tone="negative"
          count="Spending recorded this month"
        />
        <AmountBox
          label="Net"
          amount={net}
          currency={currency}
          icon={Landmark}
          tone={netTone}
          sign="always"
          count="Income less expenses"
        />
      </div>

      <div className="rounded-3xl border bg-background/70 p-4 shadow-sm shadow-foreground/5">
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
    </TonalWidget>
  );
}
