import { db } from '@/lib/db'
import { transactions, accounts, categories } from '@/lib/db/schema'
import { auth } from '@/lib/auth/config'
import { eq, and, isNull, desc } from 'drizzle-orm'
import { TransactionList } from '@/components/transactions/TransactionList'
import { TransactionForm } from '@/components/transactions/TransactionForm'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Plus } from 'lucide-react'

export default async function TransactionsPage() {
  const session = await auth()
  const userId = session!.user!.id!

  const [txList, accountList, categoryList] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(and(eq(transactions.userId, userId), isNull(transactions.deletedAt)))
      .orderBy(desc(transactions.date))
      .limit(100),
    db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), isNull(accounts.deletedAt))),
    db.select().from(categories).where(isNull(categories.deletedAt)),
  ])

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <Sheet>
          <SheetTrigger render={<Button size="sm" />}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>New Transaction</SheetTitle>
            </SheetHeader>
            <div className="mt-4 px-4">
              <TransactionForm accounts={accountList} categories={categoryList} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
      <TransactionList transactions={txList} />
    </div>
  )
}
