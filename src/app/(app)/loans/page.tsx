import { db } from '@/lib/db'
import { loans } from '@/lib/db/schema'
import { auth } from '@/lib/auth/config'
import { eq, and, isNull } from 'drizzle-orm'
import { LoanCard } from '@/components/loans/LoanCard'
import { LoanForm } from '@/components/loans/LoanForm'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'

export default async function LoansPage() {
  const session = await auth()
  const userId = session!.user!.id!

  const loanList = await db.select().from(loans)
    .where(and(eq(loans.userId, userId), isNull(loans.deletedAt)))

  const totalOutstanding = loanList.reduce(
    (sum, l) => sum + Number(l.outstandingBalance ?? l.principal),
    0,
  )

  // Use the currency of the first loan for the summary, fallback to INR
  const summaryCurrency = loanList[0]?.currency ?? 'INR'

  return (
    <div className="p-4 space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Outstanding</p>
          <p className="text-xl font-bold text-red-500">
            {formatCurrency(totalOutstanding, summaryCurrency)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Active Loans</p>
          <p className="text-xl font-bold">{loanList.length}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Loans</h1>
        <Sheet>
          <SheetTrigger render={<Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Loan</Button>} />
          <SheetContent>
            <SheetHeader><SheetTitle>New Loan</SheetTitle></SheetHeader>
            <div className="mt-4 px-4 pb-4 overflow-y-auto"><LoanForm /></div>
          </SheetContent>
        </Sheet>
      </div>

      {loanList.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">No loans yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loanList.map(loan => <LoanCard key={loan.id} loan={loan} />)}
        </div>
      )}
    </div>
  )
}
