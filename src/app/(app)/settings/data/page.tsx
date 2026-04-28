import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

export default function DataPage() {
  return (
    <div className="space-y-6 max-w-lg">
      <h2 className="text-lg font-semibold">Data</h2>

      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h3 className="font-medium">Export Transactions</h3>
        <p className="text-sm text-muted-foreground">
          Download all your transactions as a CSV file.
        </p>
        <a
          href="/api/export"
          download
          className="inline-flex items-center h-8 gap-1.5 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-sm font-medium transition-all"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </a>
      </div>

      <div className="rounded-lg border border-destructive/30 bg-card p-4 space-y-3">
        <h3 className="font-medium text-destructive">Danger Zone</h3>
        <p className="text-sm text-muted-foreground">
          Account deletion is not available in this version. Contact support if you need to remove your data.
        </p>
      </div>
    </div>
  )
}
