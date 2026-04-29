import { db } from "@/lib/db";
import { transactions, accounts, categories } from "@/lib/db/schema";
import { auth } from "@/lib/auth/config";
import { eq, and, isNull, desc } from "drizzle-orm";
import { TransactionList } from "@/components/transactions/TransactionList";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
    db.select().from(categories).where(isNull(categories.deletedAt)),
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
            <Sheet>
              <SheetTrigger
                render={<Button size="lg" className="rounded-2xl" />}
              >
                <Plus className="h-4 w-4" />
                Add transaction
              </SheetTrigger>
              <SheetContent className="sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>New transaction</SheetTitle>
                  <SheetDescription>
                    Capture the basics first. You can keep it simple and add
                    more detail later.
                  </SheetDescription>
                </SheetHeader>
                <div className="overflow-y-auto px-4 pb-4">
                  <TransactionForm
                    accounts={accountList}
                    categories={categoryList}
                  />
                </div>
              </SheetContent>
            </Sheet>
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
        <TransactionList transactions={txList} />
      )}
    </PageShell>
  );
}
