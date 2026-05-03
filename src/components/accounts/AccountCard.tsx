import Link from 'next/link'
import { WalletCards, Banknote, PiggyBank, Wallet } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import type { Account } from '@/lib/db/schema'

interface Props {
  account: Account & { balance: number }
}

const TYPE_STYLES: Record<string, { bg: string; text: string; Icon: React.ComponentType<{ className?: string }> }> = {
  bank: { bg: 'bg-sky-100 dark:bg-sky-950', text: 'text-sky-700 dark:text-sky-300', Icon: WalletCards },
  wallet: { bg: 'bg-violet-100 dark:bg-violet-950', text: 'text-violet-700 dark:text-violet-300', Icon: Wallet },
  cash: { bg: 'bg-amber-100 dark:bg-amber-950', text: 'text-amber-700 dark:text-amber-300', Icon: Banknote },
  savings: { bg: 'bg-emerald-100 dark:bg-emerald-950', text: 'text-emerald-700 dark:text-emerald-300', Icon: PiggyBank },
}

export function AccountCard({ account }: Props) {
  const style = TYPE_STYLES[account.type] ?? TYPE_STYLES.bank
  const Icon = style.Icon

  return (
    <Link
      href={`/accounts/${account.id}`}
      className="group rounded-3xl border bg-card p-5 shadow-sm hover:shadow-md transition-all space-y-4 block"
    >
      <div className="flex items-start justify-between">
        <div className={cn('flex size-11 items-center justify-center rounded-2xl', style.bg, style.text)}>
          <Icon className="size-5" />
        </div>
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{account.type}</span>
      </div>
      <div>
        <p className="text-base font-semibold">{account.name}</p>
        <p className={cn('text-2xl font-bold mt-1 tabular-nums', account.balance < 0 ? 'text-rose-600' : 'text-foreground')}>
          {formatCurrency(account.balance, account.currency)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">{account.currency}</p>
      </div>
    </Link>
  )
}
