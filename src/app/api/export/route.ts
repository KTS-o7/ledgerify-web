import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { transactions, accounts, categories } from '@/lib/db/schema'
import { eq, and, isNull, desc } from 'drizzle-orm'

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db
    .select({
      date: transactions.date,
      type: transactions.type,
      amount: transactions.amount,
      currency: transactions.currency,
      note: transactions.note,
      accountName: accounts.name,
      categoryName: categories.name,
    })
    .from(transactions)
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(and(eq(transactions.userId, session.user.id), isNull(transactions.deletedAt)))
    .orderBy(desc(transactions.date))

  const header = 'date,type,amount,currency,category,account,note\n'
  const csv = rows
    .map((t) =>
      [
        t.date,
        t.type,
        t.amount,
        t.currency,
        escapeCsvField(t.categoryName ?? ''),
        escapeCsvField(t.accountName ?? ''),
        escapeCsvField(t.note ?? ''),
      ].join(',')
    )
    .join('\n')

  return new NextResponse(header + csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="ledgerify-export.csv"',
    },
  })
}
