import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { parseCSV } from '@/lib/utils/csv'
import { db } from '@/lib/db'
import { transactions, categories, accounts, users } from '@/lib/db/schema'
import { eq, and, isNull, or } from 'drizzle-orm'
import { getRate } from '@/lib/utils/currency'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id

  const userRow = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  const baseCurrency = userRow[0]?.defaultCurrency ?? 'INR'

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const text = await file.text()
  const rows = parseCSV(text)

  const errors: string[] = []
  let imported = 0

  for (const [i, row] of rows.entries()) {
    const rowNum = i + 2
    try {
      // validate required fields
      if (!row.date || !row.type || !row.amount || !row.account) {
        errors.push(`Row ${rowNum}: missing required fields (date, type, amount, account)`)
        continue
      }

      // resolve account (must exist)
      const accountRows = await db.select().from(accounts)
        .where(and(eq(accounts.userId, userId), eq(accounts.name, row.account), isNull(accounts.deletedAt)))
        .limit(1)
      if (!accountRows.length) {
        errors.push(`Row ${rowNum}: account "${row.account}" not found`)
        continue
      }

      // resolve or create category
      let categoryId: string | null = null
      if (row.category) {
        const catRows = await db.select().from(categories)
          .where(and(
            eq(categories.name, row.category),
            isNull(categories.deletedAt),
            or(eq(categories.userId, userId), isNull(categories.userId)),
          ))
          .limit(1)
        if (catRows.length) {
          categoryId = catRows[0].id
        } else {
          const type = row.type === 'income' ? 'income' : 'expense'
          const [newCat] = await db.insert(categories).values({
            userId,
            name: row.category,
            type,
          }).returning()
          categoryId = newCat.id
        }
      }

      const txType = row.type as 'income' | 'expense' | 'transfer'
      if (!['income', 'expense', 'transfer'].includes(txType)) {
        errors.push(`Row ${rowNum}: invalid type "${row.type}"`)
        continue
      }

      const amount = parseFloat(row.amount)
      const currency = row.currency || 'INR'
      const rate = await getRate(currency, baseCurrency)
      const convertedAmount = amount * rate

      await db.insert(transactions).values({
        userId,
        accountId: accountRows[0].id,
        type: txType,
        amount: String(amount),
        currency,
        convertedAmount: String(convertedAmount),
        baseCurrency,
        categoryId,
        note: row.note || null,
        date: row.date,
      })
      imported++
    } catch (e) {
      errors.push(`Row ${rowNum}: ${String(e)}`)
    }
  }

  return NextResponse.json({ imported, errors, total: rows.length })
}
