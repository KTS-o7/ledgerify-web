import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { transactions } from '@/lib/db/schema'
import { eq, and, isNull, desc } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db.select().from(transactions)
    .where(and(eq(transactions.userId, session.user.id), isNull(transactions.deletedAt)))
    .orderBy(desc(transactions.date))

  const header = 'date,type,amount,currency,note\n'
  const csv = rows.map(t =>
    `${t.date},${t.type},${t.amount},${t.currency},"${(t.note ?? '').replace(/"/g, '""')}"`
  ).join('\n')

  return new NextResponse(header + csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="ledgerify-export.csv"',
    },
  })
}
