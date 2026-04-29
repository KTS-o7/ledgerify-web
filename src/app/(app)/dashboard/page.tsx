import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db";
import {
  accounts,
  categories,
  insurancePolicies,
  loans,
  transactions,
  users,
} from "@/lib/db/schema";
import { and, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { Plus, ReceiptText, Settings, WalletCards } from "lucide-react";

import { CashFlowSummary } from "@/components/dashboard/CashFlowSummary";
import { DashboardSections } from "@/components/dashboard/DashboardSections";
import { NetworthCard } from "@/components/dashboard/NetworthCard";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { UpcomingAlerts } from "@/components/dashboard/UpcomingAlerts";
import {
  HeaderActionLink,
  MetricCard,
  PageHeader,
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
    db.select().from(categories).where(isNull(categories.deletedAt)),
  ]);

  const displayName = user?.name?.split(" ")[0] ?? "there";
  const hasAccounts = accountList.length > 0;
  const hasCategories = categoryList.length > 0;
  const hasTransactions = recentTxs.length > 0;

  return (
    <PageShell size="wide">
      <PageHeader
        eyebrow="Quiet Ledger"
        title={`Good to see you, ${displayName}`}
        description="Your private money home for cash flow, net worth, upcoming obligations, and daily activity."
        action={
          hasAccounts ? (
            <HeaderActionLink href="/transactions">
              <Plus className="h-4 w-4" />
              Add transaction
            </HeaderActionLink>
          ) : (
            <HeaderActionLink href="/settings/accounts">
              <Plus className="h-4 w-4" />
              Set up account
            </HeaderActionLink>
          )
        }
      >
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{accountList.length} accounts</span>
          <span>·</span>
          <span>{monthlyTxs.length} this month</span>
          <span>·</span>
          <span>{baseCurrency} home currency</span>
        </div>
      </PageHeader>

      <DashboardSections
        setup={
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
        }
        snapshot={<NetworthCard {...networthData} currency={baseCurrency} />}
        basics={
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard
              label="Accounts"
              value={accountList.length}
              description="Places where money lives: bank, wallet, cash, or savings."
              icon={WalletCards}
              tone={hasAccounts ? "positive" : "warning"}
            />
            <MetricCard
              label="Categories"
              value={categoryList.length}
              description="Simple labels that make spending easier to understand."
              icon={Settings}
              tone={hasCategories ? "positive" : "warning"}
            />
            <MetricCard
              label="Recent entries"
              value={recentTxs.length}
              description="Latest activity captured in your private ledger."
              icon={ReceiptText}
              tone={hasTransactions ? "positive" : "neutral"}
            />
          </div>
        }
        cashFlow={<CashFlowSummary transactions={monthlyTxs} currency={baseCurrency} />}
        recent={<RecentTransactions transactions={recentTxs} />}
        attention={<UpcomingAlerts loans={loanList} policies={policyList} />}
      />
    </PageShell>
  );
}
