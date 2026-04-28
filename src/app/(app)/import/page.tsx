'use client'
import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { generateTemplateCSV } from '@/lib/utils/csv'
import { Upload, Download } from 'lucide-react'

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
    <div className="p-4 space-y-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold">Import Transactions</h1>

      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h2 className="font-semibold">Step 1: Download template</h2>
        <p className="text-sm text-muted-foreground">Download the CSV template, fill it in, then upload.</p>
        <Button variant="outline" onClick={downloadTemplate}>
          <Download className="h-4 w-4 mr-2" />Download Template
        </Button>
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h2 className="font-semibold">Step 2: Upload your CSV</h2>
        <form onSubmit={handleUpload} className="space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading}>
            <Upload className="h-4 w-4 mr-2" />
            {loading ? 'Importing…' : 'Import'}
          </Button>
        </form>
      </div>

      {result && (
        <div className="rounded-lg border bg-card p-4 space-y-2">
          <h2 className="font-semibold">Result</h2>
          <p className="text-sm text-green-600">✓ {result.imported} of {result.total} transactions imported</p>
          {result.errors.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-destructive">{result.errors.length} errors:</p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-muted-foreground">{e}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
