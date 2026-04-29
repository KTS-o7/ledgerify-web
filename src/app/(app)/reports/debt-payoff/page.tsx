import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { users, loans } from '@/lib/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { addMonths, format, parseISO } from 'date-fns'
import { EmptyState, FinancialAmount, MetricCard, PageHeader, PageShell, StatusPill } from '@/components/shared/quiet-ledger'
import { CalendarClock, Landmark, ReceiptIndianRupee } from 'lucide-react'

export default async function DebtPayoffPage() {
  const session = await auth()
  const userId = session!.user!.id!

  const userRow = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  const currency = userRow[0]?.defaultCurrency ?? 'INR'

  const loanList = await db.select().from(loans).where(and(eq(loans.userId, userId), isNull(loans.deletedAt)))
  const totalOutstanding = loanList.reduce((sum, loan) => sum + Number(loan.outstandingBalance ?? loan.principal), 0)
  const totalEmi = loanList.reduce((sum, loan) => sum + Number(loan.emiAmount), 0)

  return (
    <PageShell size="wide">
      <PageHeader
        eyebrow="Report"
        title="Debt payoff"
        description="Loan payoff projections based on recorded tenure, EMI, and start date."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Outstanding" value={<FinancialAmount amount={totalOutstanding} currency={currency} sign="never" />} icon={Landmark} tone={totalOutstanding > 0 ? 'negative' : 'neutral'} />
        <MetricCard label="Monthly EMI" value={<FinancialAmount amount={totalEmi} currency={currency} sign="never" />} icon={ReceiptIndianRupee} tone={totalEmi > 0 ? 'warning' : 'neutral'} />
        <MetricCard label="Loans" value={loanList.length} icon={CalendarClock} tone={loanList.length > 0 ? 'info' : 'neutral'} />
      </div>
      {loanList.length === 0 ? (
        <EmptyState icon={Landmark} title="No loans found" description="Add loans to review payoff timing and repayment load." />
      ) : (
        <div className="overflow-x-auto rounded-3xl border bg-card/85 p-2 shadow-sm shadow-foreground/5">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 pr-4 font-medium text-right">Principal</th>
                <th className="py-2 pr-4 font-medium text-right">Outstanding</th>
                <th className="py-2 pr-4 font-medium text-right">Rate</th>
                <th className="py-2 pr-4 font-medium text-right">EMI</th>
                <th className="py-2 pr-4 font-medium text-right">Total Interest</th>
                <th className="py-2 font-medium text-right">Payoff Date</th>
              </tr>
            </thead>
            <tbody>
              {loanList.map(loan => {
                const principal = Number(loan.principal)
                const emi = Number(loan.emiAmount)
                const totalPaid = emi * loan.tenureMonths
                const totalInterest = totalPaid - principal
                const payoffDate = addMonths(parseISO(loan.startDate), loan.tenureMonths)
                return (
                  <tr key={loan.id} className="border-b hover:bg-muted/30">
                    <td className="py-3 pr-4 font-medium">{loan.name}</td>
                    <td className="py-3 pr-4 capitalize"><StatusPill tone="negative">{loan.loanType}</StatusPill></td>
                    <td className="py-3 pr-4 text-right"><FinancialAmount amount={principal} currency={currency} sign="never" /></td>
                    <td className="py-2 pr-4 text-right">
                      {loan.outstandingBalance != null
                        ? <FinancialAmount amount={Number(loan.outstandingBalance)} currency={currency} sign="never" />
                        : '—'}
                    </td>
                    <td className="py-3 pr-4 text-right">{Number(loan.interestRate).toFixed(2)}%</td>
                    <td className="py-3 pr-4 text-right"><FinancialAmount amount={emi} currency={currency} sign="never" /></td>
                    <td className="py-3 pr-4 text-right"><FinancialAmount amount={totalInterest} currency={currency} sign="never" /></td>
                    <td className="py-3 text-right">{format(payoffDate, 'MMM yyyy')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  )
}
