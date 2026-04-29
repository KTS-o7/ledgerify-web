'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ArrowLeftRight, TrendingUp, Plus, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

const primaryTabs = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/investments', label: 'Invest', icon: TrendingUp },
]

const moreItems = [
  { href: '/loans', label: 'Loans' },
  { href: '/insurance', label: 'Insurance' },
  { href: '/budgets', label: 'Budgets' },
  { href: '/budgets/goals', label: 'Goals' },
  { href: '/networth', label: 'Net Worth' },
  { href: '/reports', label: 'Reports' },
  { href: '/import', label: 'Import' },
  { href: '/settings', label: 'Settings' },
]

export function BottomNav({ className }: { className?: string }) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  return (
    <>
      {/* More drawer overlay */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setMoreOpen(false)}>
          <div
            className="absolute bottom-16 left-0 right-0 bg-card border-t rounded-t-xl p-4 grid grid-cols-3 gap-3"
            onClick={e => e.stopPropagation()}
          >
            {moreItems.map(item => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  'flex flex-col items-center py-3 px-2 rounded-lg text-xs font-medium',
                  pathname.startsWith(item.href) ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <nav className={cn('fixed bottom-0 left-0 right-0 z-30 border-t bg-card flex items-center justify-around h-16 px-2', className)}>
        {primaryTabs.map(tab => {
          const active = pathname === tab.href || pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex flex-col items-center gap-1 px-4 py-2 rounded-lg text-xs',
                active ? 'text-primary font-semibold' : 'text-muted-foreground'
              )}
            >
              <tab.icon className="h-5 w-5" />
              {tab.label}
            </Link>
          )
        })}

        {/* Quick add — links to transactions page */}
        <Link
          href="/transactions"
          className="flex flex-col items-center gap-1 px-3 py-2 rounded-full bg-primary text-primary-foreground"
        >
          <Plus className="h-5 w-5" />
        </Link>

        <button
          onClick={() => setMoreOpen(v => !v)}
          className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg text-xs text-muted-foreground"
        >
          <Menu className="h-5 w-5" />
          More
        </button>
      </nav>
    </>
  )
}
