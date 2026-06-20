import { createResource, createSignal, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { Plus, ShoppingCart, Coffee, Bus, Banknote, Receipt, TrendingUp, TrendingDown, AlertTriangle } from "lucide-solid";
import { api } from "../lib/api";
import { formatCurrency, pgDateToString, numericToFloat } from "../lib/format";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { Stat } from "../components/ui/stat";
import { Sparkline } from "../components/ui/sparkline";
import { TransactionRow } from "../components/ui/transaction-row";
import { SkeletonBlock } from "../components/ui/skeleton";
import { Sheet } from "../components/ui/sheet";
import { TransactionForm } from "../components/forms/transaction-form";
import { MonthPicker } from "../components/ui/month-picker";

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
  budget_status: Array<{ name: string; spent: number; amount: number; spent_pct: number }>;
  monthly_networth: Array<{ date: string; total_balance: number }>;
  category_spending: Array<{ category_id: string; category_name: string; color: string; total: number }>;
}

interface InsurancePolicy {
  id: string;
  name: string;
  renewal_date: unknown; // pgtype.Date
}

interface Loan {
  id: string;
  name: string;
  start_date: unknown;      // pgtype.Date
  emi_amount: unknown;      // pgtype.Numeric
  outstanding_balance: unknown; // pgtype.Numeric
}

interface AlertItem {
  key: string;
  message: string;
}

function categoryIcon(category: string) {
  const c = (category || "").toLowerCase();
  if (c.includes("groceries")) return ShoppingCart;
  if (c.includes("dining") || c.includes("food") || c.includes("coffee")) return Coffee;
  if (c.includes("transport") || c.includes("travel")) return Bus;
  if (c.includes("income") || c.includes("salary")) return Banknote;
  return Receipt;
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatAlertDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", { year: "numeric", month: "short", day: "numeric" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Compute the next EMI due date for a loan given its start_date.
 *  Returns a YYYY-MM-DD string or null if indeterminate. */
function nextEmiDate(startDateRaw: unknown): string | null {
  const dateStr = pgDateToString(startDateRaw);
  if (!dateStr) return null;
  const start = new Date(dateStr + "T00:00:00Z");
  if (isNaN(start.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfMonth = start.getUTCDate();
  // Find the next (or current) month's payment day
  let candidate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), dayOfMonth));
  if (candidate < today) {
    candidate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, dayOfMonth));
  }
  return candidate.toISOString().slice(0, 10);
}

export default function Dashboard() {
  const [month, setMonth] = createSignal(currentMonth());
  const [summary, { refetch }] = createResource(month, (m) => api.get<Summary>(`/v1/summary?month=${m}`));
  const [insurance] = createResource(() =>
    api.get<InsurancePolicy[]>("/v1/insurance").catch(() => [] as InsurancePolicy[])
  );
  const [loans] = createResource(() =>
    api.get<Loan[]>("/v1/loans").catch(() => [] as Loan[])
  );
  const [sheetOpen, setSheetOpen] = createSignal(false);

  /** Build alert items from available data. Returns [] when nothing to alert. */
  const alerts = (): AlertItem[] => {
    const items: AlertItem[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ── 1. Budget ≥ 80% ──────────────────────────────────────────────────
    const budgets = summary()?.budget_status ?? [];
    for (const b of budgets) {
      if (b.spent_pct >= 80) {
        items.push({
          key: `budget-${b.name}`,
          message: `${b.name} is ${b.spent_pct}% used`,
        });
      }
    }

    // ── 2. Insurance renewals within 30 days ─────────────────────────────
    const policies = insurance() ?? [];
    for (const p of policies) {
      const dateStr = pgDateToString(p.renewal_date);
      if (!dateStr) continue;
      const renewal = new Date(dateStr + "T00:00:00Z");
      if (isNaN(renewal.getTime())) continue;
      const diffDays = Math.floor((renewal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays <= 30) {
        items.push({
          key: `insurance-${p.id}`,
          message: `${p.name} renews on ${formatAlertDate(dateStr)}`,
        });
      }
    }

    // ── 3. Loans with EMI within 14 days ─────────────────────────────────
    const loanList = loans() ?? [];
    for (const l of loanList) {
      const outstanding = numericToFloat(l.outstanding_balance);
      const emi = numericToFloat(l.emi_amount);
      if (outstanding <= 0 || emi <= 0) continue;
      const nextDate = nextEmiDate(l.start_date);
      if (!nextDate) continue;
      const due = new Date(nextDate + "T00:00:00Z");
      const diffDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays <= 14) {
        items.push({
          key: `loan-${l.id}`,
          message: `${l.name} payment due ${formatAlertDate(nextDate)}`,
        });
      }
    }

    return items;
  };

  return (
    <>
      <PageHeader
        title="Dashboard"
        actions={
          <div class="flex items-center gap-2">
            <MonthPicker value={month()} onChange={setMonth} />
            <button type="button" aria-label="Add transaction"
              onClick={() => setSheetOpen(true)}
              class="w-10 h-10 flex items-center justify-center rounded-full bg-surface text-text active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg">
              <Plus size={20} />
            </button>
          </div>
        }
      />

      <div class="p-4 md:p-6 flex flex-col gap-3 md:gap-4">

        {/* ── Alerts strip ─────────────────────────────────────────── */}
        <Show when={alerts().length > 0}>
          <div class="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <For each={alerts()}>
              {(alert) => (
                <div class="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-[16px] bg-surface border border-border-strong text-sm">
                  <AlertTriangle size={14} class="text-yellow-400 flex-shrink-0" />
                  <span class="text-text whitespace-nowrap">{alert.message}</span>
                </div>
              )}
            </For>
          </div>
        </Show>

        <div class="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4">
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
                  <BentoBlock class="col-span-1 md:col-span-8 flex flex-col gap-4 p-5">
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
                    <BentoBlock class="flex flex-col justify-center py-5">
                      <div class="flex items-center gap-2 mb-1">
                        <TrendingUp size={16} class="text-primary" />
                        <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide">Income</span>
                      </div>
                      <span class="font-display font-bold text-2xl text-primary">{formatCurrency(s().total_income)}</span>
                    </BentoBlock>
                    <BentoBlock class="flex flex-col justify-center py-5">
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
