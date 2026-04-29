'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Database, FolderTree, UserRound, WalletCards } from 'lucide-react'

import { cn } from '@/lib/utils'

const tabs = [
  {
    href: '/settings/profile',
    label: 'Profile',
    description: 'Name, currency, timezone',
    icon: UserRound,
  },
  {
    href: '/settings/accounts',
    label: 'Accounts',
    description: 'Bank, wallet, cash, savings',
    icon: WalletCards,
  },
  {
    href: '/settings/categories',
    label: 'Categories',
    description: 'Income and spending labels',
    icon: FolderTree,
  },
  {
    href: '/settings/data',
    label: 'Data',
    description: 'Export and safety',
    icon: Database,
  },
]

export function SettingsNav() {
  const pathname = usePathname()

  return (
    <nav className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const active = pathname === tab.href

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'group flex min-h-20 items-center gap-3 rounded-3xl border bg-card/70 p-3 text-left shadow-sm shadow-foreground/5 transition hover:-translate-y-0.5 hover:bg-card',
              active && 'border-primary/30 bg-primary/10 shadow-primary/10'
            )}
          >
            <span
              className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-2xl border bg-muted/70 text-muted-foreground',
                active && 'border-primary/20 bg-primary/10 text-primary'
              )}
            >
              <Icon className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">
                {tab.label}
              </span>
              <span className="block text-xs leading-5 text-muted-foreground">
                {tab.description}
              </span>
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
