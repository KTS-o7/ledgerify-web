import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db";
import {
  accounts,
  budgets,
  categories,
  insurancePolicies,
  loans,
  transactions,
  users,
} from "@/lib/db/schema";
import { and, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { endOfMonth, format, startOfMonth, subDays } from "date-fns";
import { Plus } from "lucide-react";
import { getBudgetPeriod } from "@/lib/utils/budgetPeriod";
import { BudgetHealthBar } from "@/components/dashboard/BudgetHealthBar";
import { UpcomingRecurring } from "@/components/dashboard/UpcomingRecurring";
import { SpendingHeatmap } from "@/components/dashboard/SpendingHeatmap";
import { CashFlowSummary } from "@/components/dashboard/CashFlowSummary";
import { NetworthCard } from "@/components/dashboard/NetworthCard";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { UpcomingAlerts } from "@/components/dashboard/UpcomingAlerts";
import {
  HeaderActionLink,
  PageShell,
  SetupChecklist,
} from "@/components/shared/quiet-ledger";
import { computeNetworth } from "@/lib/utils/networth";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const userRow = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const user = userRow[0];
  const baseCurrency = user?.defaultCurrency ?? "INR";

  const now = new Date();
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");

  const [
    networthData,
    monthlyTxs,
    recentTxs,
    loanList,
    policyList,
    accountList,
    categoryList,
  ] = await Promise.all([
    computeNetworth(userId, baseCurrency),
    db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          isNull(transactions.deletedAt),
          gte(transactions.date, monthStart),
          lte(transactions.date, monthEnd),
        ),
      ),
    db
      .select()
      .from(transactions)
      .where(
        and(eq(transactions.userId, userId), isNull(transactions.deletedAt)),
      )
      .orderBy(desc(transactions.date))
      .limit(5),
    db
      .select()
      .from(loans)
      .where(and(eq(loans.userId, userId), isNull(loans.deletedAt))),
    db
      .select()
      .from(insurancePolicies)
      .where(
        and(
          eq(insurancePolicies.userId, userId),
          isNull(insurancePolicies.deletedAt),
        ),
      ),
    db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), isNull(accounts.deletedAt))),
    db.select().from(categories).where(
      and(
        isNull(categories.deletedAt),
        or(eq(categories.userId, userId), isNull(categories.userId)),
      )
    ),
  ]);

  const displayName = user?.name?.split(" ")[0] ?? "there";
  const hasAccounts = accountList.length > 0;
  const hasCategories = categoryList.length > 0;
  const hasTransactions = recentTxs.length > 0;

  const budgetList = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.userId, userId), isNull(budgets.deletedAt)));

  const recurringTxs = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.isRecurring, true),
        isNull(transactions.deletedAt),
      ),
    );

  const heatmapStart = format(subDays(now, 83), "yyyy-MM-dd");
  const heatmapTxs = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "expense"),
        isNull(transactions.deletedAt),
        gte(transactions.date, heatmapStart),
      ),
    );

  const dailySpend: Record<string, number> = {};
  for (const t of heatmapTxs) {
    dailySpend[t.date] =
      (dailySpend[t.date] ?? 0) + Number(t.convertedAmount ?? t.amount);
  }

  const budgetHealth = await Promise.all(
    budgetList.map(async (b) => {
      const period = getBudgetPeriod(b);
      const pStart = format(period.start, "yyyy-MM-dd");
      const pEnd = format(period.end, "yyyy-MM-dd");
      const bTxs = heatmapTxs.filter(
        (t) =>
          t.type === "expense" &&
          t.date >= pStart &&
          t.date <= pEnd &&
          (!b.categoryId || t.categoryId === b.categoryId),
      );
      const spent = bTxs.reduce(
        (s, t) => s + Number(t.convertedAmount ?? t.amount),
        0,
      );
      return { budget: b, spent, period };
    }),
  );

  return (
    <PageShell size="wide">
      {/* Header — date + name + action, no description filler */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            {format(now, "EEEE, d MMMM")}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {displayName}
          </h1>
        </div>
        {hasAccounts ? (
          <HeaderActionLink href="/transactions">
            <Plus className="h-4 w-4 mr-1" /> Add transaction
          </HeaderActionLink>
        ) : (
          <HeaderActionLink href="/settings/accounts">
            <Plus className="h-4 w-4 mr-1" /> Add account
          </HeaderActionLink>
        )}
      </div>

      {/* Setup checklist — only when incomplete */}
      {(!hasAccounts || !hasCategories || !hasTransactions) && (
        <SetupChecklist
          items={[
            {
              label: "Add your first account",
              href: "/settings/accounts",
              complete: hasAccounts,
            },
            {
              label: "Review categories",
              href: "/settings/categories",
              complete: hasCategories,
            },
            {
              label: "Record your first transaction",
              href: "/transactions",
              complete: hasTransactions,
            },
          ]}
        />
      )}

      {/* Net worth hero */}
      <NetworthCard {...networthData} currency={baseCurrency} />

      {/* Budget health */}
      {budgetHealth.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
            Budgets
          </h2>
          <div className="space-y-2">
            {budgetHealth.map(({ budget, spent, period }) => (
              <BudgetHealthBar
                key={budget.id}
                budget={budget}
                spent={spent}
                period={period}
              />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming recurring */}
      <UpcomingRecurring transactions={recurringTxs} />

      {/* Cash flow + recent side by side on desktop */}
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <CashFlowSummary transactions={monthlyTxs} currency={baseCurrency} />
        <RecentTransactions transactions={recentTxs} />
      </div>

      {/* Spending heatmap */}
      <SpendingHeatmap dailySpend={dailySpend} currency={baseCurrency} />

      {/* Loans / insurance alerts — only if non-empty */}
      <UpcomingAlerts loans={loanList} policies={policyList} />
    </PageShell>
  );
}
