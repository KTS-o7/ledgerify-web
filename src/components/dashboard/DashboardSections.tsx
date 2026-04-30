'use client'

import { useState } from 'react'
import { Eye, EyeOff, SlidersHorizontal } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'ledgerify:dashboard-sections'

const defaultVisibility = {
  snapshot: true,
  setup: true,
  basics: true,
  cashFlow: true,
  recent: true,
  attention: true,
}

type SectionKey = keyof typeof defaultVisibility
type VisibilityState = typeof defaultVisibility

const sectionLabels: Array<{ key: SectionKey; label: string }> = [
  { key: 'snapshot', label: 'Snapshot' },
  { key: 'setup', label: 'Setup' },
  { key: 'basics', label: 'Basics' },
  { key: 'cashFlow', label: 'Cash flow' },
  { key: 'recent', label: 'Recent' },
  { key: 'attention', label: 'Attention' },
]

function readVisibility() {
  if (typeof window === 'undefined') {
    return defaultVisibility
  }

  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) {
    return defaultVisibility
  }

  try {
    return { ...defaultVisibility, ...JSON.parse(stored) }
  } catch {
    return defaultVisibility
  }
}

export function DashboardSections({
  setup,
  snapshot,
  basics,
  cashFlow,
  recent,
  attention,
}: {
  setup: React.ReactNode
  snapshot: React.ReactNode
  basics: React.ReactNode
  cashFlow: React.ReactNode
  recent: React.ReactNode
  attention: React.ReactNode
}) {
  const [visibility, setVisibility] = useState<VisibilityState>(readVisibility)

  function toggle(key: SectionKey) {
    setVisibility((current) => {
      const next = { ...current, [key]: !current[key] }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  const hiddenCount = sectionLabels.filter((item) => !visibility[item.key]).length

  return (
    <div className="space-y-5">
      <div className="rounded-[1.5rem] border bg-card/80 p-2.5 shadow-sm shadow-foreground/5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 px-1 text-sm font-semibold">
            <SlidersHorizontal className="size-4 text-primary" />
            Home sections
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {sectionLabels.map((item) => {
              const active = visibility[item.key]
              const Icon = active ? Eye : EyeOff

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => toggle(item.key)}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition',
                    active
                      ? 'border-primary/20 bg-primary text-primary-foreground shadow-sm'
                      : 'border-border bg-background/70 text-muted-foreground hover:bg-muted'
                  )}
                >
                  <Icon className="size-3.5" />
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>
        {hiddenCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 rounded-2xl"
            onClick={() => {
              setVisibility(defaultVisibility)
              localStorage.removeItem(STORAGE_KEY)
            }}
          >
            Show all sections
          </Button>
        )}
      </div>

      {visibility.setup && setup}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
        <div className="space-y-5">
          {visibility.snapshot && snapshot}
          {visibility.basics && basics}
          {visibility.cashFlow && cashFlow}
        </div>
        <div className="space-y-5">
          {visibility.attention && attention}
          {visibility.recent && recent}
        </div>
      </div>
    </div>
  )
}
