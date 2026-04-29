'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, ArrowLeftRight, TrendingUp, CreditCard,
  Shield, Target, BarChart2, Upload, Settings, PiggyBank
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/investments', label: 'Investments', icon: TrendingUp },
  { href: '/loans', label: 'Loans', icon: CreditCard },
  { href: '/insurance', label: 'Insurance', icon: Shield },
  { href: '/budgets', label: 'Budgets', icon: Target },
  { href: '/budgets/goals', label: 'Goals', icon: PiggyBank },
  { href: '/networth', label: 'Net Worth', icon: BarChart2 },
  { href: '/reports', label: 'Reports', icon: BarChart2 },
  { href: '/import', label: 'Import', icon: Upload },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname()

  return (
    <aside className={cn('w-56 shrink-0 border-r bg-card flex flex-col h-screen sticky top-0', className)}>
      <div className="px-4 py-5 border-b">
        <span className="text-lg font-bold tracking-tight">Ledgerify</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                active
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
