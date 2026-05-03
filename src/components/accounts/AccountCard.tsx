import Link from 'next/link'
import { formatCurrency } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import type { Account } from '@/lib/db/schema'

interface Props {
  account: Account & { balance: number }
}

const TYPE_DOT: Record<string, string> = {
  bank: 'bg-sky-500',
  wallet: 'bg-violet-500',
  cash: 'bg-amber-500',
  savings: 'bg-emerald-500',
}

export function AccountCard({ account }: Props) {
  return (
    <Link href={`/accounts/${account.id}`}
      className="group block rounded-2xl border bg-card p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-3">
        <span className={cn('size-2 rounded-full', TYPE_DOT[account.type] ?? 'bg-muted-foreground')} />
        <span className="text-xs font-medium text-muted-foreground capitalize">{account.type}</span>
      </div>
      <p className="text-sm font-semibold truncate">{account.name}</p>
      <p className={cn(
        'text-3xl font-bold tabular-nums tracking-tight mt-1',
        account.balance < 0 ? 'text-rose-600' : 'text-foreground'
      )}>
        {formatCurrency(account.balance, account.currency)}
      </p>
    </Link>
  )
}
