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

type Tone = 'neutral' | 'positive' | 'negative' | 'warning' | 'info' | 'primary'

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
        'mx-auto flex w-full flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-8',
        size === 'narrow' && 'max-w-3xl',
        size === 'default' && 'max-w-6xl',
        size === 'wide' && 'max-w-7xl',
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
  eyebrow,
  action,
  children,
  className,
}: {
  title: string
  description?: string
  eyebrow?: string
  action?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-3xl border bg-card/80 p-5 shadow-sm shadow-foreground/5 backdrop-blur sm:p-6 lg:flex-row lg:items-end lg:justify-between',
        className
      )}
    >
      <div className="min-w-0 space-y-2">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {eyebrow}
          </p>
        )}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              {description}
            </p>
          )}
        </div>
        {children}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
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
        <h2 className="text-base font-semibold tracking-tight text-foreground">
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
    <span data-financial-value className={cn('tabular-nums', className)}>
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
            <CardTitle className="text-2xl font-bold tracking-tight sm:text-3xl">
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
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>
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
    <Card className={cn('rounded-3xl bg-card/85 shadow-sm ring-0', className)}>
      <CardHeader>
        <CardTitle>Finish your money home</CardTitle>
        <CardDescription>
          A few basics make Ledgerify easier to use every day.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
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
