'use client'
import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { generateTemplateCSV } from '@/lib/utils/csv'
import { Download, FileSpreadsheet, ShieldCheck, Upload } from 'lucide-react'
import {
  IconBadge,
  PageHeader,
  PageShell,
  SectionHeader,
  TonalWidget,
} from '@/components/shared/quiet-ledger'

interface ImportResult { imported: number; errors: string[]; total: number }

export default function ImportPage() {
  const [result, setResult] = useState<ImportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function downloadTemplate() {
    const csv = generateTemplateCSV()
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'ledgerify-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) { setError('Please select a file'); return }

    setLoading(true)
    setError('')
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/import', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) setError(data.error || 'Import failed')
      else setResult(data)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageShell size="wide">
      <PageHeader
        eyebrow="Bulk capture"
        title="Import transactions"
        description="Bring historical activity into Ledgerify with a CSV template, then review reports and categories with better context."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <SectionHeader
            title="CSV workflow"
            description="Use the template first so account, category, date, and amount fields are shaped correctly."
          />

          <div className="grid gap-4 md:grid-cols-2">
            <TonalWidget tone="info" className="p-5 sm:p-5">
              <IconBadge icon={Download} tone="info" />
              <div className="mt-4 space-y-2">
                <h2 className="text-base font-semibold">
                  Download template
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  Fill in the CSV locally before uploading it back into your private ledger.
                </p>
                <Button variant="outline" onClick={downloadTemplate} className="rounded-2xl">
                  <Download className="h-4 w-4 mr-2" />
                  Download template
                </Button>
              </div>
            </TonalWidget>

            <TonalWidget tone="primary" className="p-5 sm:p-5">
              <IconBadge icon={Upload} tone="primary" />
              <div className="mt-4 space-y-2">
                <h2 className="text-base font-semibold">Upload CSV</h2>
                <form onSubmit={handleUpload} className="space-y-3">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv"
                    className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-2xl file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
                  />
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" disabled={loading} className="rounded-2xl">
                    <Upload className="h-4 w-4 mr-2" />
                    {loading ? 'Importing…' : 'Import transactions'}
                  </Button>
                </form>
              </div>
            </TonalWidget>
          </div>
        </div>

        <aside className="space-y-4">
          <TonalWidget tone="info" className="p-5 sm:p-5">
            <IconBadge icon={FileSpreadsheet} tone="info" />
            <p className="mt-4 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Format
            </p>
            <h2 className="mt-2 text-2xl font-bold">CSV</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Best for bank exports and spreadsheet cleanup.
            </p>
          </TonalWidget>
          <TonalWidget tone="positive" className="p-5 sm:p-5">
            <IconBadge icon={ShieldCheck} tone="positive" />
            <p className="mt-4 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Safety
            </p>
            <h2 className="mt-2 text-2xl font-bold">Review</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Import reports row errors instead of silently hiding them.
            </p>
          </TonalWidget>
        </aside>
      </div>

      {result && (
        <div className="rounded-3xl border bg-card/85 p-5 shadow-sm shadow-foreground/5">
          <h2 className="font-semibold">Import result</h2>
          <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
            {result.imported} of {result.total} transactions imported.
          </p>
          {result.errors.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-sm font-medium text-destructive">{result.errors.length} errors:</p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-muted-foreground">{e}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </PageShell>
  )
}
