import { db } from '@/lib/db'
import { loans, users } from '@/lib/db/schema'
import { auth } from '@/lib/auth/config'
import { eq, and, isNull } from 'drizzle-orm'
import { LoanCard } from '@/components/loans/LoanCard'
import { LoanForm } from '@/components/loans/LoanForm'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import {
  EmptyState,
  FinancialAmount,
  MetricCard,
  PageHeader,
  PageShell,
  SectionHeader,
} from '@/components/shared/quiet-ledger'
import { Landmark, Plus, ReceiptIndianRupee, TrendingDown } from 'lucide-react'

export default async function LoansPage() {
  const session = await auth()
  const userId = session!.user!.id!

  const [userRow, loanList] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)).limit(1),
    db.select().from(loans)
      .where(and(eq(loans.userId, userId), isNull(loans.deletedAt))),
  ])

  const totalOutstanding = loanList.reduce(
    (sum, l) => sum + Number(l.outstandingBalance ?? l.principal),
    0,
  )
  const totalEmi = loanList.reduce((sum, loan) => sum + Number(loan.emiAmount), 0)

  const summaryCurrency = loanList[0]?.currency ?? userRow[0]?.defaultCurrency ?? 'INR'

  return (
    <PageShell size="wide">
      <PageHeader
        eyebrow="Obligations"
        title="Loans"
        description="Keep debt visible without making it noisy: outstanding balance, EMI load, and repayment progress."
        action={
        <Sheet>
          <SheetTrigger render={<Button size="lg" className="rounded-2xl" />}>
            <Plus className="h-4 w-4 mr-1" />
            Add loan
          </SheetTrigger>
          <SheetContent className="sm:max-w-md">
            <SheetHeader>
              <SheetTitle>New loan</SheetTitle>
              <SheetDescription>
                Add the repayment basics so obligations show up in your household picture.
              </SheetDescription>
            </SheetHeader>
            <div className="overflow-y-auto px-4 pb-4"><LoanForm /></div>
          </SheetContent>
        </Sheet>
        }
      >
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{loanList.length} active loans</span>
          <span>·</span>
          <span>{summaryCurrency} summary currency</span>
        </div>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Outstanding"
          value={<FinancialAmount amount={totalOutstanding} currency={summaryCurrency} sign="never" />}
          description="Tracked balance still to be repaid."
          icon={Landmark}
          tone={totalOutstanding > 0 ? 'negative' : 'neutral'}
        />
        <MetricCard
          label="Monthly EMI"
          value={<FinancialAmount amount={totalEmi} currency={summaryCurrency} sign="never" />}
          description="Combined recurring repayment load."
          icon={ReceiptIndianRupee}
          tone={totalEmi > 0 ? 'warning' : 'neutral'}
        />
        <MetricCard
          label="Active loans"
          value={loanList.length}
          description="Debt accounts included in net worth."
          icon={TrendingDown}
          tone={loanList.length > 0 ? 'info' : 'neutral'}
        />
      </div>

      {loanList.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No loans tracked"
          description="Add a loan if you want liabilities and repayment progress reflected in your private money home."
        />
      ) : (
        <section className="space-y-3">
          <SectionHeader
            title="Repayment progress"
            description="Each card shows what remains and how much has been repaid."
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {loanList.map(loan => <LoanCard key={loan.id} loan={loan} />)}
          </div>
        </section>
      )}
    </PageShell>
  )
}
