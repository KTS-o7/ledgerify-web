import Link from 'next/link'
import type * as React from 'react'
import type { LucideIcon } from 'lucide-react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type Tone =
  | 'neutral'
  | 'positive'
  | 'negative'
  | 'warning'
  | 'info'
  | 'primary'
  | 'cash'
  | 'budget'
  | 'goal'
  | 'investment'
  | 'loan'
  | 'insurance'

const toneStyles: Record<
  Tone,
  {
    text: string
    bg: string
    border: string
    icon: string
    ring: string
  }
> = {
  neutral: {
    text: 'text-muted-foreground',
    bg: 'bg-muted/70',
    border: 'border-border',
    icon: 'text-muted-foreground',
    ring: 'ring-border',
  },
  positive: {
    text: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    border: 'border-emerald-200/80 dark:border-emerald-900',
    icon: 'text-emerald-600 dark:text-emerald-300',
    ring: 'ring-emerald-200/80 dark:ring-emerald-900',
  },
  negative: {
    text: 'text-rose-700 dark:text-rose-300',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    border: 'border-rose-200/80 dark:border-rose-900',
    icon: 'text-rose-600 dark:text-rose-300',
    ring: 'ring-rose-200/80 dark:ring-rose-900',
  },
  warning: {
    text: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-200/80 dark:border-amber-900',
    icon: 'text-amber-600 dark:text-amber-300',
    ring: 'ring-amber-200/80 dark:ring-amber-900',
  },
  info: {
    text: 'text-sky-700 dark:text-sky-300',
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    border: 'border-sky-200/80 dark:border-sky-900',
    icon: 'text-sky-600 dark:text-sky-300',
    ring: 'ring-sky-200/80 dark:ring-sky-900',
  },
  primary: {
    text: 'text-primary',
    bg: 'bg-primary/10',
    border: 'border-primary/20',
    icon: 'text-primary',
    ring: 'ring-primary/20',
  },
  cash: {
    text: 'text-sky-800 dark:text-sky-200',
    bg: 'bg-sky-100/80 dark:bg-sky-950/50',
    border: 'border-sky-200/90 dark:border-sky-900',
    icon: 'text-sky-700 dark:text-sky-300',
    ring: 'ring-sky-200/90 dark:ring-sky-900',
  },
  budget: {
    text: 'text-amber-800 dark:text-amber-200',
    bg: 'bg-amber-100/80 dark:bg-amber-950/50',
    border: 'border-amber-200/90 dark:border-amber-900',
    icon: 'text-amber-700 dark:text-amber-300',
    ring: 'ring-amber-200/90 dark:ring-amber-900',
  },
  goal: {
    text: 'text-teal-800 dark:text-teal-200',
    bg: 'bg-teal-100/80 dark:bg-teal-950/50',
    border: 'border-teal-200/90 dark:border-teal-900',
    icon: 'text-teal-700 dark:text-teal-300',
    ring: 'ring-teal-200/90 dark:ring-teal-900',
  },
  investment: {
    text: 'text-violet-800 dark:text-violet-200',
    bg: 'bg-violet-100/80 dark:bg-violet-950/50',
    border: 'border-violet-200/90 dark:border-violet-900',
    icon: 'text-violet-700 dark:text-violet-300',
    ring: 'ring-violet-200/90 dark:ring-violet-900',
  },
  loan: {
    text: 'text-orange-800 dark:text-orange-200',
    bg: 'bg-orange-100/80 dark:bg-orange-950/50',
    border: 'border-orange-200/90 dark:border-orange-900',
    icon: 'text-orange-700 dark:text-orange-300',
    ring: 'ring-orange-200/90 dark:ring-orange-900',
  },
  insurance: {
    text: 'text-indigo-800 dark:text-indigo-200',
    bg: 'bg-indigo-100/80 dark:bg-indigo-950/50',
    border: 'border-indigo-200/90 dark:border-indigo-900',
    icon: 'text-indigo-700 dark:text-indigo-300',
    ring: 'ring-indigo-200/90 dark:ring-indigo-900',
  },
}

export function PageShell({
  children,
  className,
  size = 'default',
}: {
  children: React.ReactNode
  className?: string
  size?: 'default' | 'wide' | 'narrow'
}) {
  return (
    <div
      className={cn(
        'flex w-full flex-col gap-5 px-4 py-4 sm:px-5 lg:px-6 lg:py-6',
        size === 'narrow' && 'max-w-3xl',
        size === 'default' && 'max-w-6xl',
        size === 'wide' && 'max-w-none',
        className
      )}
    >
      {children}
    </div>
  )
}

export function PageHeader({
  title,
  description,
  eyebrow: _eyebrow,
  action,
  children,
  className,
}: {
  title: string
  description?: string
  /** @deprecated Eyebrows are not rendered — kept for backward compat only */
  eyebrow?: string
  action?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 pb-2', className)}>
      <div className="min-w-0">
        <h1
          className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
          style={{ textWrap: 'balance' } as React.CSSProperties}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
        {children && <div className="mt-2">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function SectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-end justify-between gap-4', className)}>
      <div className="min-w-0 space-y-1">
        <h2
          data-display-text
          className="text-base font-semibold text-foreground"
        >
          {title}
        </h2>
        {description && (
          <p className="text-sm leading-5 text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function FinancialAmount({
  amount,
  currency,
  locale = 'en-IN',
  sign,
  className,
  maximumFractionDigits = 2,
}: {
  amount: number
  currency: string
  locale?: string
  sign?: 'auto' | 'always' | 'never'
  className?: string
  maximumFractionDigits?: number
}) {
  const value = Math.abs(amount)
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits,
  }).format(value)

  const prefix =
    sign === 'never'
      ? ''
      : sign === 'always'
        ? amount >= 0
          ? '+'
          : '-'
        : amount < 0
          ? '-'
          : ''

  return (
    <span
      data-financial-value
      className={cn('financial-display tabular-nums', className)}
    >
      {prefix}
      {formatted}
    </span>
  )
}

export function DeltaBadge({
  value,
  label,
  className,
}: {
  value?: number | null
  label?: string
  className?: string
}) {
  const tone: Tone =
    value == null || value === 0 ? 'neutral' : value > 0 ? 'positive' : 'negative'

  const Icon =
    value == null || value === 0 ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight

  return (
    <span
      className={cn(
        'inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium',
        toneStyles[tone].bg,
        toneStyles[tone].border,
        toneStyles[tone].text,
        className
      )}
    >
      <Icon className="size-3.5" />
      {label ?? (value == null ? 'No change yet' : `${value > 0 ? '+' : ''}${value}%`)}
    </span>
  )
}

export function StatusPill({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode
  tone?: Tone
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-full border px-2.5 text-xs font-medium',
        toneStyles[tone].bg,
        toneStyles[tone].border,
        toneStyles[tone].text,
        className
      )}
    >
      {children}
    </span>
  )
}

export function IconBadge({
  icon: Icon,
  tone = 'neutral',
  className,
}: {
  icon: LucideIcon
  tone?: Tone
  className?: string
}) {
  return (
    <span
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-2xl border ring-1',
        toneStyles[tone].bg,
        toneStyles[tone].border,
        toneStyles[tone].ring,
        className
      )}
    >
      <Icon className={cn('size-5', toneStyles[tone].icon)} />
    </span>
  )
}

export function TonalWidget({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode
  tone?: Tone
  className?: string
}) {
  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-[1.75rem] border p-4 shadow-sm shadow-foreground/5 sm:p-5',
        toneStyles[tone].bg,
        toneStyles[tone].border,
        className
      )}
    >
      {children}
    </section>
  )
}

export function WidgetHeading({
  icon: Icon,
  tone = 'primary',
  eyebrow,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  tone?: Tone
  eyebrow?: string
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <IconBadge icon={Icon} tone={tone} className="size-12 rounded-[1.35rem]" />
        <div className="min-w-0 space-y-1">
          {eyebrow && (
            <p className={cn('text-xs font-semibold uppercase tracking-[0.14em]', toneStyles[tone].text)}>
              {eyebrow}
            </p>
          )}
          <h2 data-display-text className="text-xl font-bold text-foreground">
            {title}
          </h2>
          {description && (
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function AmountBox({
  label,
  amount,
  currency,
  count,
  icon: Icon,
  tone = 'neutral',
  sign = 'never',
}: {
  label: string
  amount: number
  currency: string
  count?: React.ReactNode
  icon?: LucideIcon
  tone?: Tone
  sign?: 'auto' | 'always' | 'never'
}) {
  return (
    <div className="rounded-3xl border bg-background/70 p-4 shadow-sm shadow-foreground/5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </p>
          <p className={cn('mt-2 text-xl font-bold', toneStyles[tone].text)}>
            <FinancialAmount amount={amount} currency={currency} sign={sign} />
          </p>
        </div>
        {Icon && <IconBadge icon={Icon} tone={tone} className="size-10" />}
      </div>
      {count && <p className="mt-3 text-xs leading-5 text-muted-foreground">{count}</p>}
    </div>
  )
}

export function MetricCard({
  label,
  value,
  description,
  icon: Icon,
  tone = 'neutral',
  footer,
  action,
  className,
}: {
  label: string
  value: React.ReactNode
  description?: React.ReactNode
  icon?: LucideIcon
  tone?: Tone
  footer?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <Card
      className={cn(
        'rounded-3xl border bg-card/85 shadow-sm shadow-foreground/5 ring-0 backdrop-blur',
        className
      )}
    >
      <CardHeader className="gap-3 px-5 pt-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <CardDescription className="text-xs font-medium uppercase tracking-[0.14em]">
              {label}
            </CardDescription>
            <CardTitle className="financial-display text-2xl font-bold sm:text-3xl">
              {value}
            </CardTitle>
          </div>
          {Icon && <IconBadge icon={Icon} tone={tone} />}
        </div>
        {description && (
          <div className="text-sm leading-5 text-muted-foreground">{description}</div>
        )}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      {footer && <CardContent className="px-5 pb-5">{footer}</CardContent>}
    </Card>
  )
}

export function ProgressMeter({
  value,
  max = 100,
  tone = 'primary',
  label,
  className,
}: {
  value: number
  max?: number
  tone?: Tone
  label?: string
  className?: string
}) {
  const percentage = Math.max(0, Math.min(100, max === 0 ? 0 : (value / max) * 100))

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          <span className="tabular-nums">{Math.round(percentage)}%</span>
        </div>
      )}
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            tone === 'positive' && 'bg-emerald-500',
            tone === 'negative' && 'bg-rose-500',
            tone === 'warning' && 'bg-amber-500',
            tone === 'info' && 'bg-sky-500',
            tone === 'primary' && 'bg-primary',
            tone === 'cash' && 'bg-sky-500',
            tone === 'budget' && 'bg-amber-500',
            tone === 'goal' && 'bg-teal-500',
            tone === 'investment' && 'bg-violet-500',
            tone === 'loan' && 'bg-orange-500',
            tone === 'insurance' && 'bg-indigo-500',
            tone === 'neutral' && 'bg-muted-foreground'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-3xl border border-dashed bg-card/60 px-6 py-12 text-center',
        className
      )}
    >
      {Icon && <IconBadge icon={Icon} tone="primary" className="mb-4" />}
      <div className="max-w-md space-y-2">
        <h3 data-display-text className="text-base font-semibold tracking-tight">
          {title}
        </h3>
        {description && (
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function QuickActionCard({
  href,
  icon: Icon,
  title,
  description,
  tone = 'primary',
  className,
}: {
  href: string
  icon: LucideIcon
  title: string
  description: string
  tone?: Tone
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center gap-3 rounded-2xl border bg-card/80 p-3 text-left shadow-sm shadow-foreground/5 transition hover:-translate-y-0.5 hover:bg-card hover:shadow-md',
        className
      )}
    >
      <IconBadge icon={Icon} tone={tone} className="size-11" />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="block text-xs leading-5 text-muted-foreground">
          {description}
        </span>
      </span>
    </Link>
  )
}

export function ChartPanel({
  title,
  description,
  insight,
  children,
}: {
  title: string
  description?: string
  insight?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-3xl border bg-card/85 p-5 shadow-sm shadow-foreground/5">
      <SectionHeader title={title} description={description} />
      {insight && (
        <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm leading-6 text-primary">
          {insight}
        </div>
      )}
      <div className="mt-5 min-h-72">{children}</div>
    </section>
  )
}

export function SetupChecklist({
  items,
  className,
}: {
  items: Array<{
    label: string
    href: string
    complete?: boolean
  }>
  className?: string
}) {
  const incomplete = items.filter((item) => !item.complete)

  if (incomplete.length === 0) {
    return null
  }

  return (
    <Card className={cn('rounded-[1.75rem] bg-card/90 shadow-sm ring-0', className)}>
      <CardHeader className="px-4 py-4">
        <CardTitle className="text-base">Finish your money home</CardTitle>
        <CardDescription>
          A few basics make Ledgerify easier to use every day.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 px-4 pb-4 md:grid-cols-3">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center justify-between rounded-2xl border px-3 py-2.5 text-sm transition hover:bg-muted/70',
              item.complete
                ? 'border-emerald-200 bg-emerald-50/70 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'
                : 'bg-background/70'
            )}
          >
            <span>{item.label}</span>
            <span className="text-xs text-muted-foreground">
              {item.complete ? 'Done' : 'Set up'}
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}

export function HeaderActionLink({
  href,
  children,
  variant = 'default',
}: {
  href: string
  children: React.ReactNode
  variant?: React.ComponentProps<typeof Button>['variant']
}) {
  return (
    <Button render={<Link href={href} />} variant={variant}>
      {children}
    </Button>
  )
}
