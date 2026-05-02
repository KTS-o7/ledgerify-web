"use client";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

import { createTransaction } from "@/app/actions/transactions";
import { IconBadge } from "@/components/shared/quiet-ledger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Account, Category } from "@/lib/db/schema";

interface Props {
  accounts: Account[];
  categories: Category[];
}

export function TransactionForm({ accounts, categories }: Props) {
  const [state, formAction, pending] = useActionState(createTransaction, null);
  const searchParams = useSearchParams();
  const defaultCurrency = accounts[0]?.currency ?? "INR";
  const requestedType = searchParams.get("type");
  const defaultType = requestedType === "income" ? "income" : "expense";
  const incomeCategories = categories.filter(
    (category) => category.type === "income",
  );
  const expenseCategories = categories.filter(
    (category) => category.type === "expense",
  );
  const hasAccounts = accounts.length > 0;
  const transactionTypes = [
    {
      value: "expense",
      label: "Expense",
      icon: ArrowDownLeft,
      tone: "negative" as const,
    },
    {
      value: "income",
      label: "Income",
      icon: ArrowUpRight,
      tone: "positive" as const,
    },
  ];

  return (
    <form action={formAction} className="space-y-5">
      <div className="rounded-3xl border bg-primary/10 p-2">
        <div className="grid grid-cols-2 gap-2">
          {transactionTypes.map((item) => (
            <label
              key={item.value}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-2 rounded-[1.35rem] border border-transparent px-2 py-3 text-center text-xs font-semibold text-muted-foreground transition",
                "has-[:checked]:border-primary/20 has-[:checked]:bg-background has-[:checked]:text-foreground has-[:checked]:shadow-sm",
              )}
            >
              <input
                type="radio"
                name="type"
                value={item.value}
                defaultChecked={item.value === defaultType}
                className="sr-only"
              />
              <IconBadge icon={item.icon} tone={item.tone} className="size-10" />
              {item.label}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount">Amount</Label>
        <div className="grid grid-cols-[1fr_5.5rem] gap-2">
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            inputMode="decimal"
            placeholder="0.00"
            required
            className="h-14 rounded-2xl text-2xl font-semibold tabular-nums"
          />
          <Input
            id="currency"
            name="currency"
            defaultValue={defaultCurrency}
            maxLength={3}
            required
            className="h-14 rounded-2xl text-center font-semibold uppercase"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="accountId">Account</Label>
          <select
            name="accountId"
            id="accountId"
            required
            disabled={!hasAccounts}
            className="h-11 w-full rounded-2xl border border-input bg-background px-3 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {hasAccounts ? (
              accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} · {account.currency}
                </option>
              ))
            ) : (
              <option value="">Create an account first</option>
            )}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            name="date"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="h-11 rounded-2xl"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="categoryId">Category</Label>
        <select
          name="categoryId"
          id="categoryId"
          className="h-11 w-full rounded-2xl border border-input bg-background px-3 text-sm shadow-sm"
        >
          <option value="">No category yet</option>
          {expenseCategories.length > 0 && (
            <optgroup label="Expenses">
              {expenseCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </optgroup>
          )}
          {incomeCategories.length > 0 && (
            <optgroup label="Income">
              {incomeCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="note">Note</Label>
        <Input
          id="note"
          name="note"
          type="text"
          placeholder="Coffee, rent, salary…"
          autoComplete="off"
          className="h-11 rounded-2xl"
        />
      </div>

      {!hasAccounts && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Add at least one account before recording transactions.
        </div>
      )}

      {state?.error && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

      {state?.success && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Transaction saved. Add another one whenever you are ready.
        </div>
      )}

      <Button
        type="submit"
        size="lg"
        className="h-11 w-full rounded-2xl"
        disabled={pending || !hasAccounts}
      >
        {pending ? "Saving…" : "Save transaction"}
      </Button>
    </form>
  );
}
