import { createResource, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { Plus, ShoppingCart, Coffee, Bus, Banknote, Receipt } from "lucide-solid";
import { api } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { Stat } from "../components/ui/stat";
import { Sparkline } from "../components/ui/sparkline";
import { TransactionRow } from "../components/ui/transaction-row";
import { SkeletonBlock } from "../components/ui/skeleton";

interface Summary {
  total_income: number;
  total_expenses: number;
  recent_transactions: Array<{
    date: string;
    title?: string;
    merchant?: string;
    account_name: string;
    category_name: string;
    amount: number;
    type: "income" | "expense";
  }>;
  account_balances: Array<{ name: string; balance: number }>;
  budget_status: Array<{ name: string; spent: number; amount: number }>;
}

const SPARKLINE_PLACEHOLDER = [
  12, 18, 15, 22, 19, 25, 28, 24, 30, 27, 32, 29, 35, 31, 38, 34, 40, 36,
  42, 38, 45, 41, 47, 43, 50, 46, 52, 48, 55, 50,
];

function categoryIcon(category: string) {
  switch (category) {
    case "Groceries":
      return ShoppingCart;
    case "Dining":
      return Coffee;
    case "Transport":
      return Bus;
    case "Income":
      return Banknote;
    default:
      return Receipt;
  }
}

export default function Dashboard() {
  const [summary] = createResource(() => api.get<Summary>("/v1/summary"));

  return (
    <>
      <PageHeader
        title="Dashboard"
        actions={
          <button
            type="button"
            aria-label="Add"
            class="w-10 h-10 flex items-center justify-center rounded-full bg-surface text-text active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <Plus size={20} />
          </button>
        }
      />
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 p-4 md:p-6">
        <Show when={summary.loading}>
          <SkeletonBlock class="col-span-1 md:col-span-3 min-h-[200px]" />
          <SkeletonBlock class="col-span-1 min-h-[160px]" />
          <SkeletonBlock class="col-span-1 min-h-[160px]" />
        </Show>
        <Show when={summary.error}>
          <BentoBlock span={3} class="min-h-[200px] flex items-center justify-center">
            <p class="text-accent">Failed to load summary.</p>
          </BentoBlock>
        </Show>
        <Show when={summary()}>
          {(s) => {
            const balance = () => s().total_income - s().total_expenses;
            return (
              <>
                <BentoBlock span={2} size="lg" class="md:col-span-3">
                  <Stat
                    label="Total Balance"
                    value={formatCurrency(balance())}
                    size="xl"
                    trend={{ dir: balance() >= 0 ? "up" : "down", value: "+2.4% this month" }}
                  />
                </BentoBlock>
                <BentoBlock size="md" class="col-span-1">
                  <Stat label="Income" value={formatCurrency(s().total_income)} tone="primary" size="lg" />
                </BentoBlock>
                <BentoBlock size="md" class="col-span-1">
                  <Stat label="Expenses" value={formatCurrency(s().total_expenses)} size="lg" />
                </BentoBlock>
                <BentoBlock span={2} size="sm" class="md:col-span-3">
                  <div class="flex flex-col gap-2">
                    <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide">30-day spending</span>
                    <Sparkline values={SPARKLINE_PLACEHOLDER} height={48} class="w-full" tone="primary" />
                  </div>
                </BentoBlock>
                <BentoBlock span={2} size="md" class="md:col-span-3">
                  <div class="flex items-center justify-between mb-3">
                    <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide">Recent</span>
                    <A href="/activity" class="text-sm text-primary hover:underline">View all →</A>
                  </div>
                  <div class="flex flex-col">
                    <For each={(s().recent_transactions || []).slice(0, 5)}>
                      {(tx) => (
                        <TransactionRow
                          icon={categoryIcon(tx.category_name)}
                          merchant={tx.title || tx.merchant || "—"}
                          category={tx.category_name || "Uncategorized"}
                          amount={tx.amount}
                          type={tx.type}
                          date={tx.date}
                        />
                      )}
                    </For>
                    <Show when={!s().recent_transactions || s().recent_transactions.length === 0}>
                      <p class="text-muted text-sm py-6 text-center">No recent transactions.</p>
                    </Show>
                  </div>
                </BentoBlock>
              </>
            );
          }}
        </Show>
      </div>
    </>
  );
}
