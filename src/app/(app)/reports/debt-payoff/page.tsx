import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { users, loans } from '@/lib/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { formatCurrency } from '@/lib/utils/format'
import { addMonths, format, parseISO } from 'date-fns'

export default async function DebtPayoffPage() {
  const session = await auth()
  const userId = session!.user!.id!

  const userRow = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  const currency = userRow[0]?.defaultCurrency ?? 'INR'

  const loanList = await db.select().from(loans).where(and(eq(loans.userId, userId), isNull(loans.deletedAt)))

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Debt Payoff</h1>
      <p className="text-muted-foreground text-sm">Loan payoff projections</p>
      {loanList.length === 0 ? (
        <p className="text-muted-foreground">No loans found.</p>
      ) : (
        <div className="overflow-x-auto">
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
                    <td className="py-2 pr-4">{loan.name}</td>
                    <td className="py-2 pr-4 capitalize">{loan.loanType}</td>
                    <td className="py-2 pr-4 text-right">{formatCurrency(principal, currency)}</td>
                    <td className="py-2 pr-4 text-right">
                      {loan.outstandingBalance != null
                        ? formatCurrency(Number(loan.outstandingBalance), currency)
                        : '—'}
                    </td>
                    <td className="py-2 pr-4 text-right">{Number(loan.interestRate).toFixed(2)}%</td>
                    <td className="py-2 pr-4 text-right">{formatCurrency(emi, currency)}</td>
                    <td className="py-2 pr-4 text-right">{formatCurrency(totalInterest, currency)}</td>
                    <td className="py-2 text-right">{format(payoffDate, 'MMM yyyy')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
