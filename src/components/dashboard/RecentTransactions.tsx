"use client";

import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  ReceiptText,
} from "lucide-react";

import type { Transaction } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import {
  EmptyState,
  FinancialAmount,
  IconBadge,
  SectionHeader,
  StatusPill,
  TonalWidget,
} from "@/components/shared/quiet-ledger";

interface Props {
  transactions: Transaction[];
}

function getTransactionIcon(type: Transaction["type"]) {
  if (type === "income") return ArrowUpRight;
  if (type === "expense") return ArrowDownLeft;
  return ArrowLeftRight;
}

function getTransactionTone(type: Transaction["type"]) {
  if (type === "income") return "positive";
  if (type === "expense") return "negative";
  return "info";
}

export function RecentTransactions({ transactions }: Props) {
  return (
    <section className="space-y-3">
      <SectionHeader
        title="Recent activity"
        description="The latest money movements added to your ledger."
        action={
          <Link
            href="/transactions"
            className="text-sm font-medium text-primary hover:underline"
          >
            View all
          </Link>
        }
      />

      {transactions.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="No recent transactions"
          description="Add your first income, expense, or transfer to start building your money history."
          className="py-8"
        />
      ) : (
        <TonalWidget tone="neutral" className="space-y-2 p-3 sm:p-3">
          {transactions.map((transaction, index) => {
            const Icon = getTransactionIcon(transaction.type);
            const tone = getTransactionTone(transaction.type);
            const signedAmount =
              transaction.type === "expense"
                ? -Number(transaction.amount)
                : Number(transaction.amount);

            return (
              <div
                key={transaction.id}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-[1.5rem] border bg-background/70 p-3 shadow-sm shadow-foreground/5 transition hover:bg-background sm:p-4",
                  index === 0 && "border-primary/20",
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <IconBadge
                    icon={Icon}
                    tone={tone}
                    className="size-12 rounded-[1.35rem]"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {transaction.note || "Untitled transaction"}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <StatusPill tone={tone}>{transaction.type}</StatusPill>
                      <span className="text-xs text-muted-foreground">
                        {transaction.date}
                      </span>
                    </div>
                  </div>
                </div>

                <p
                  className={cn(
                    "shrink-0 text-sm font-bold tabular-nums",
                    transaction.type === "income" &&
                      "text-emerald-700 dark:text-emerald-300",
                    transaction.type === "expense" &&
                      "text-rose-700 dark:text-rose-300",
                  )}
                >
                  <FinancialAmount
                    amount={signedAmount}
                    currency={transaction.currency}
                    sign="always"
                  />
                </p>
              </div>
            );
          })}
        </TonalWidget>
      )}
    </section>
  );
}
