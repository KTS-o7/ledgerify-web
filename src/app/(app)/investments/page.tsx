import { db } from '@/lib/db'
import { investments } from '@/lib/db/schema'
import { auth } from '@/lib/auth/config'
import { eq, and, isNull } from 'drizzle-orm'
import { AssetCard } from '@/components/investments/AssetCard'
import { InvestmentForm } from '@/components/investments/InvestmentForm'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default async function InvestmentsPage() {
  const session = await auth()
  const userId = session!.user!.id!

  const invList = await db.select().from(investments)
    .where(and(eq(investments.userId, userId), isNull(investments.deletedAt)))

  // compute portfolio totals
  let totalInvested = 0
  let totalCurrent = 0
  for (const inv of invList) {
    const qty = Number(inv.quantity ?? 1)
    const buy = Number(inv.buyPrice ?? 0)
    const cur = Number(inv.currentPrice ?? inv.buyPrice ?? 0)
    totalInvested += buy * qty
    totalCurrent += cur * qty
  }
  const totalPnL = totalCurrent - totalInvested
  const totalPnLPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0

  return (
    <div className="p-4 space-y-6">
      {/* Portfolio summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Invested</p>
          <p className="text-xl font-bold">₹{totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Current Value</p>
          <p className="text-xl font-bold">₹{totalCurrent.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">P&L</p>
          <p className={`text-xl font-bold ${totalPnL >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {totalPnL >= 0 ? '+' : ''}₹{totalPnL.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            <span className="text-sm ml-1">({totalPnLPct.toFixed(1)}%)</span>
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Investments</h1>
        <Sheet>
          <SheetTrigger render={<Button size="sm"><Plus className="h-4 w-4 mr-1" />Add</Button>} />
          <SheetContent>
            <SheetHeader><SheetTitle>New Investment</SheetTitle></SheetHeader>
            <div className="mt-4 px-4 pb-4 overflow-y-auto"><InvestmentForm /></div>
          </SheetContent>
        </Sheet>
      </div>

      {invList.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">No investments yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {invList.map(inv => <AssetCard key={inv.id} investment={inv} />)}
        </div>
      )}
    </div>
  )
}
