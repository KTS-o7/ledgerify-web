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
  credit_card: 'bg-rose-500',
}

export function AccountCard({ account }: Props) {
  const isCreditCard = account.type === 'credit_card'
  const creditLimit = account.creditLimit ? Number(account.creditLimit) : null
  const utilisationPct = creditLimit && creditLimit > 0
    ? Math.round((account.balance / creditLimit) * 100)
    : null

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
        isCreditCard ? 'text-rose-600' : account.balance < 0 ? 'text-rose-600' : 'text-foreground'
      )}>
        {formatCurrency(account.balance, account.currency)}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">
        {isCreditCard ? 'outstanding' : account.currency}
      </p>
      {isCreditCard && creditLimit && (
        <div className="mt-2 space-y-1">
          <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full', utilisationPct! > 80 ? 'bg-rose-500' : utilisationPct! > 50 ? 'bg-amber-400' : 'bg-primary')}
              style={{ width: `${Math.min(100, utilisationPct!)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {utilisationPct}% of {formatCurrency(creditLimit, account.currency)} limit
          </p>
        </div>
      )}
    </Link>
  )
}
