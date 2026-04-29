import { DatabaseBackup, Download, ShieldAlert } from 'lucide-react'

import { IconBadge, SectionHeader } from '@/components/shared/quiet-ledger'

export default function DataPage() {
  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-4">
        <SectionHeader
          title="Data"
          description="Export your ledger when you want a local copy or a spreadsheet backup."
        />

        <div className="rounded-3xl border bg-card/85 p-5 shadow-sm shadow-foreground/5">
          <div className="flex items-start gap-3">
            <IconBadge icon={DatabaseBackup} tone="info" />
            <div className="min-w-0 space-y-2">
              <h2 className="text-base font-semibold tracking-tight">
                Export transactions
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Download all recorded transactions as a CSV file for review,
                backup, or personal analysis.
              </p>
              <a
                href="/api/export"
                download
                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-border bg-background px-3 text-sm font-medium transition hover:bg-muted"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </a>
            </div>
          </div>
        </div>
      </div>

      <aside className="rounded-3xl border border-destructive/20 bg-card/70 p-5 shadow-sm shadow-foreground/5">
        <IconBadge icon={ShieldAlert} tone="warning" />
        <div className="mt-4 space-y-2">
          <h2 className="text-base font-semibold tracking-tight text-destructive">
            Data safety
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Account deletion is not available in this version. Export first if
            you need a copy of your data before any manual cleanup.
          </p>
        </div>
      </aside>
    </section>
  )
}
