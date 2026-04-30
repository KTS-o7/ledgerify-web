import Link from 'next/link'
import { TrendingUp, PieChart, BarChart2, CreditCard, Target } from 'lucide-react'
import {
  IconBadge,
  PageHeader,
  PageShell,
  QuickActionCard,
  SectionHeader,
  TonalWidget,
} from '@/components/shared/quiet-ledger'

const reports = [
  { href: '/reports/cash-flow', title: 'Cash Flow', description: 'Income vs expenses over time', icon: TrendingUp },
  { href: '/reports/category-breakdown', title: 'Category Breakdown', description: 'Where your money goes', icon: PieChart },
  { href: '/reports/investment-returns', title: 'Investment Returns', description: 'Portfolio P&L and returns', icon: BarChart2 },
  { href: '/reports/debt-payoff', title: 'Debt Payoff', description: 'Loan payoff projections', icon: CreditCard },
  { href: '/reports/budget-vs-actual', title: 'Budget vs Actual', description: 'Spending vs your budgets', icon: Target },
]

export default function ReportsPage() {
  return (
    <PageShell size="wide">
      <PageHeader
        eyebrow="Analyze"
        title="Reports"
        description="Use reports when you need a little more context than the daily dashboard: cash flow, categories, budgets, debt, and investments."
      />

      <section className="space-y-3">
        <SectionHeader
          title="Insight pages"
          description="Each report focuses on one financial question and keeps the chart close to the supporting numbers."
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {reports.map(r => (
          <TonalWidget
            key={r.href}
            tone="primary"
            className="group p-5 transition hover:-translate-y-0.5 hover:bg-card hover:shadow-md sm:p-5"
          >
            <Link href={r.href} className="block">
              <IconBadge icon={r.icon} tone="primary" />
              <div className="mt-4 space-y-2">
                <h2 className="text-base font-semibold">{r.title}</h2>
                <p className="text-sm leading-6 text-muted-foreground">{r.description}</p>
              </div>
            </Link>
          </TonalWidget>
        ))}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <QuickActionCard
          href="/transactions"
          icon={TrendingUp}
          title="Add recent activity"
          description="Reports improve when the daily ledger is current."
          tone="positive"
        />
        <QuickActionCard
          href="/import"
          icon={BarChart2}
          title="Import from CSV"
          description="Bring older transactions in before reviewing trends."
          tone="info"
        />
      </div>
    </PageShell>
  )
}
