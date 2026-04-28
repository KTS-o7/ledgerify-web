import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { TrendingUp, PieChart, BarChart2, CreditCard, Target } from 'lucide-react'

const reports = [
  { href: '/reports/cash-flow', title: 'Cash Flow', description: 'Income vs expenses over time', icon: TrendingUp },
  { href: '/reports/category-breakdown', title: 'Category Breakdown', description: 'Where your money goes', icon: PieChart },
  { href: '/reports/investment-returns', title: 'Investment Returns', description: 'Portfolio P&L and returns', icon: BarChart2 },
  { href: '/reports/debt-payoff', title: 'Debt Payoff', description: 'Loan payoff projections', icon: CreditCard },
  { href: '/reports/budget-vs-actual', title: 'Budget vs Actual', description: 'Spending vs your budgets', icon: Target },
]

export default function ReportsPage() {
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Reports</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {reports.map(r => (
          <Link key={r.href} href={r.href}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <r.icon className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">{r.title}</CardTitle>
                </div>
                <CardDescription>{r.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
