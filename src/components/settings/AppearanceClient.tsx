'use client'

import { useState } from 'react'
import { Check, Columns3, Rows3 } from 'lucide-react'

import { appearanceStorageKeys } from '@/components/shared/AppearancePreferenceBridge'
import { IconBadge, SectionHeader, StatusPill } from '@/components/shared/quiet-ledger'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const accents = [
  { value: 'ledger', label: 'Ledger green', swatch: 'bg-[oklch(0.42_0.115_172)]' },
  { value: 'teal', label: 'Teal', swatch: 'bg-[oklch(0.55_0.13_185)]' },
  { value: 'sky', label: 'Sky', swatch: 'bg-[oklch(0.56_0.14_235)]' },
  { value: 'indigo', label: 'Indigo', swatch: 'bg-[oklch(0.5_0.16_285)]' },
  { value: 'rose', label: 'Rose', swatch: 'bg-[oklch(0.55_0.17_18)]' },
] as const

const densities = [
  {
    value: 'comfortable',
    label: 'Comfortable',
    description: 'Roomier cards and setup screens.',
    icon: Rows3,
  },
  {
    value: 'compact',
    label: 'Compact',
    description: 'Tighter surfaces for repeated review.',
    icon: Columns3,
  },
] as const

type Accent = (typeof accents)[number]['value']
type Density = (typeof densities)[number]['value']

function applyAccent(accent: Accent) {
  if (accent === 'ledger') {
    delete document.documentElement.dataset.accent
    localStorage.removeItem(appearanceStorageKeys.accent)
    return
  }

  document.documentElement.dataset.accent = accent
  localStorage.setItem(appearanceStorageKeys.accent, accent)
}

function applyDensity(density: Density) {
  if (density === 'comfortable') {
    delete document.documentElement.dataset.density
    localStorage.removeItem(appearanceStorageKeys.density)
    return
  }

  document.documentElement.dataset.density = density
  localStorage.setItem(appearanceStorageKeys.density, density)
}

export function AppearanceClient() {
  const [accent, setAccent] = useState<Accent>(() => {
    if (typeof window === 'undefined') {
      return 'ledger'
    }

    const stored = localStorage.getItem(appearanceStorageKeys.accent) as Accent | null
    return stored && accents.some((item) => item.value === stored) ? stored : 'ledger'
  })
  const [density, setDensity] = useState<Density>(() => {
    if (typeof window === 'undefined') {
      return 'comfortable'
    }

    const stored = localStorage.getItem(appearanceStorageKeys.density) as Density | null
    return stored && densities.some((item) => item.value === stored)
      ? stored
      : 'comfortable'
  })

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        <div className="rounded-3xl border bg-card/85 p-5 shadow-sm shadow-foreground/5">
          <SectionHeader
            title="Accent color"
            description="Personalize the app chrome while keeping income, expense, goal, and debt colors semantic."
          />
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {accents.map((item) => {
              const active = accent === item.value

              return (
                <button
                  key={item.value}
                  type="button"
                  className={cn(
                    'flex items-center justify-between rounded-3xl border bg-background/70 p-4 text-left transition hover:bg-muted/60',
                    active && 'border-primary/40 bg-primary/10'
                  )}
                  onClick={() => {
                    setAccent(item.value)
                    applyAccent(item.value)
                  }}
                >
                  <span className="flex items-center gap-3">
                    <span className={cn('size-8 rounded-full shadow-inner', item.swatch)} />
                    <span className="text-sm font-semibold">{item.label}</span>
                  </span>
                  {active && <Check className="size-4 text-primary" />}
                </button>
              )
            })}
          </div>
        </div>

        <div className="rounded-3xl border bg-card/85 p-5 shadow-sm shadow-foreground/5">
          <SectionHeader
            title="Density"
            description="Choose a little more air for setup screens or a tighter rhythm for repeated review."
          />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {densities.map((item) => {
              const active = density === item.value
              const Icon = item.icon

              return (
                <button
                  key={item.value}
                  type="button"
                  className={cn(
                    'rounded-3xl border bg-background/70 p-4 text-left transition hover:bg-muted/60',
                    active && 'border-primary/40 bg-primary/10'
                  )}
                  onClick={() => {
                    setDensity(item.value)
                    applyDensity(item.value)
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <IconBadge icon={Icon} tone={active ? 'primary' : 'neutral'} />
                    {active && <Check className="size-4 text-primary" />}
                  </div>
                  <div className="mt-4 space-y-1">
                    <p className="text-sm font-semibold">{item.label}</p>
                    <p className="text-xs leading-5 text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <aside className="rounded-3xl border bg-card/70 p-5 shadow-sm shadow-foreground/5">
        <StatusPill tone="primary">Local preference</StatusPill>
        <div className="mt-4 space-y-2">
          <h2 className="text-base font-semibold tracking-tight">No account changes</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Appearance choices are stored in this browser only. They do not touch your
            Ledgerify schema, backend, or financial records.
          </p>
        </div>
        <div className="mt-5 rounded-3xl border bg-background/70 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Current
          </p>
          <p className="mt-2 text-sm font-semibold">
            {accents.find((item) => item.value === accent)?.label} · {density}
          </p>
        </div>
        <Button
          variant="outline"
          className="mt-4 w-full rounded-2xl"
          onClick={() => {
            setAccent('ledger')
            setDensity('comfortable')
            applyAccent('ledger')
            applyDensity('comfortable')
          }}
        >
          Reset appearance
        </Button>
      </aside>
    </section>
  )
}
