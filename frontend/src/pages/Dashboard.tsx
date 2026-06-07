import { createResource, createSignal, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { Plus, ShoppingCart, Coffee, Bus, Banknote, Receipt, TrendingUp, TrendingDown } from "lucide-solid";
import { api } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { Stat } from "../components/ui/stat";
import { Sparkline } from "../components/ui/sparkline";
import { TransactionRow } from "../components/ui/transaction-row";
import { SkeletonBlock } from "../components/ui/skeleton";
import { Sheet } from "../components/ui/sheet";
import { TransactionForm } from "../components/forms/transaction-form";

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
  monthly_networth: Array<{ date: string; total_balance: number }>;
  category_spending: Array<{ category_id: string; category_name: string; color: string; total: number }>;
}

function categoryIcon(category: string) {
  const c = (category || "").toLowerCase();
  if (c.includes("groceries")) return ShoppingCart;
  if (c.includes("dining") || c.includes("food") || c.includes("coffee")) return Coffee;
  if (c.includes("transport") || c.includes("travel")) return Bus;
  if (c.includes("income") || c.includes("salary")) return Banknote;
  return Receipt;
}

export default function Dashboard() {
  const [summary, { refetch }] = createResource(() => api.get<Summary>("/v1/summary"));
  const [sheetOpen, setSheetOpen] = createSignal(false);

  return (
    <>
      <PageHeader
        title="Dashboard"
        actions={
          <button type="button" aria-label="Add transaction"
            onClick={() => setSheetOpen(true)}
            class="w-10 h-10 flex items-center justify-center rounded-full bg-surface text-text active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg">
            <Plus size={20} />
          </button>
        }
      />

      <div class="p-4 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4">
        {/* Loading */}
        <Show when={summary.loading}>
          <SkeletonBlock class="col-span-1 md:col-span-8 min-h-[180px]" />
          <SkeletonBlock class="col-span-1 md:col-span-4 min-h-[180px]" />
          <SkeletonBlock class="col-span-1 md:col-span-6 min-h-[140px]" />
          <SkeletonBlock class="col-span-1 md:col-span-6 min-h-[140px]" />
        </Show>

        {/* Error */}
        <Show when={summary.error}>
          <BentoBlock class="col-span-1 md:col-span-12 flex items-center justify-center py-16">
            <p class="text-accent">Failed to load summary.</p>
          </BentoBlock>
        </Show>

        <Show when={summary()}>
          {(s) => {
            const balance = () => s().total_income - s().total_expenses;
            const sparkValues = () => (s().monthly_networth || []).map((r) => r.total_balance);
            const hasSpark = () => sparkValues().length > 1;
            const recentTxs = () => (s().recent_transactions || []).slice(0, 5);

            return (
              <>
                {/* Hero balance — left 8 cols desktop */}
                <BentoBlock size="lg" class="col-span-1 md:col-span-8 flex flex-col justify-between gap-6">
                  <Stat
                    label="Total Balance"
                    value={formatCurrency(balance())}
                    size="xl"
                    tone={balance() >= 0 ? "primary" : "accent"}
                    trend={{ dir: balance() >= 0 ? "up" : "down", value: `${balance() >= 0 ? "+" : ""}${formatCurrency(Math.abs(balance()))} this month` }}
                  />
                  <Show when={hasSpark()}>
                    <Sparkline values={sparkValues()} height={56} class="w-full" tone={balance() >= 0 ? "primary" : "accent"} />
                  </Show>
                </BentoBlock>

                {/* Quick stats — right 4 cols desktop */}
                <div class="col-span-1 md:col-span-4 flex flex-col gap-3">
                  <BentoBlock size="md" class="flex-1 flex flex-col justify-center">
                    <div class="flex items-center gap-2 mb-1">
                      <TrendingUp size={16} class="text-primary" />
                      <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide">Income</span>
                    </div>
                    <span class="font-display font-bold text-2xl text-primary">{formatCurrency(s().total_income)}</span>
                  </BentoBlock>
                  <BentoBlock size="md" class="flex-1 flex flex-col justify-center">
                    <div class="flex items-center gap-2 mb-1">
                      <TrendingDown size={16} class="text-muted" />
                      <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide">Expenses</span>
                    </div>
                    <span class="font-display font-bold text-2xl text-text">{formatCurrency(s().total_expenses)}</span>
                  </BentoBlock>
                </div>

                {/* Recent transactions — full width */}
                <BentoBlock class="col-span-1 md:col-span-12 p-0 overflow-hidden">
                  <div class="flex items-center justify-between px-5 py-4 border-b border-border">
                    <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide">Recent transactions</span>
                    <A href="/activity" class="text-sm text-primary hover:underline font-medium">View all →</A>
                  </div>
                  <Show when={recentTxs().length > 0} fallback={
                    <p class="text-muted text-sm py-10 text-center">No recent transactions.</p>
                  }>
                    <div class="flex flex-col px-5 divide-y divide-border">
                      <For each={recentTxs()}>
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
                    </div>
                  </Show>
                </BentoBlock>
              </>
            );
          }}
        </Show>
      </div>

      <Sheet open={sheetOpen()} onClose={() => setSheetOpen(false)} title="Add Transaction">
        <TransactionForm
          onSuccess={() => { setSheetOpen(false); refetch(); }}
          onClose={() => setSheetOpen(false)}
        />
      </Sheet>
    </>
  );
}
