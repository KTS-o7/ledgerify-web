import { db } from "@/lib/db";
import { transactions, accounts, categories } from "@/lib/db/schema";
import { auth } from "@/lib/auth/config";
import { eq, and, isNull, desc, or } from "drizzle-orm";
import { Suspense } from "react";
import { TransactionList } from "@/components/transactions/TransactionList";
import { TransactionSheetTrigger } from "@/components/transactions/TransactionSheetTrigger";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  HeaderActionLink,
  PageHeader,
  PageShell,
} from "@/components/shared/quiet-ledger";
import { Plus, WalletCards } from "lucide-react";

export default async function TransactionsPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const [txList, accountList, categoryList] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(
        and(eq(transactions.userId, userId), isNull(transactions.deletedAt)),
      )
      .orderBy(desc(transactions.date))
      .limit(100),
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

  const hasAccounts = accountList.length > 0;

  return (
    <PageShell size="wide">
      <PageHeader
        eyebrow="Daily capture"
        title="Transactions"
        description="Record income, expenses, and transfers quickly so your money picture stays current."
        action={
          hasAccounts ? (
            <Suspense
              fallback={
                <Button size="lg" className="rounded-2xl" disabled>
                  <Plus className="h-4 w-4" />
                  Add transaction
                </Button>
              }
            >
              <TransactionSheetTrigger
                accounts={accountList}
                categories={categoryList}
              />
            </Suspense>
          ) : (
            <HeaderActionLink href="/settings/accounts">
              <Plus className="h-4 w-4" />
              Add account
            </HeaderActionLink>
          )
        }
      >
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{txList.length} transactions</span>
          <span>·</span>
          <span>{accountList.length} accounts</span>
          <span>·</span>
          <span>{categoryList.length} categories</span>
        </div>
      </PageHeader>

      {!hasAccounts ? (
        <EmptyState
          icon={WalletCards}
          title="Set up your first account"
          description="Transactions need an account first. Add a bank, wallet, cash, or savings account, then come back here to start recording daily money movement."
          action={
            <HeaderActionLink href="/settings/accounts">
              <Plus className="h-4 w-4" />
              Set up account
            </HeaderActionLink>
          }
        />
      ) : (
        <TransactionList
          transactions={txList}
          accounts={accountList}
          categories={categoryList}
        />
      )}
    </PageShell>
  );
}
