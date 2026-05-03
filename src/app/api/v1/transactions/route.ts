import { NextRequest, NextResponse } from 'next/server'
import { resolveSession } from '@/lib/api/auth'
import { db } from '@/lib/db'
import { transactions, users, accounts, categories } from '@/lib/db/schema'
import { eq, and, isNull, or, gte, lte, SQL } from 'drizzle-orm'
import { z } from 'zod'
import { getRate } from '@/lib/utils/currency'
import { revalidatePath } from 'next/cache'

const createSchema = z.object({
  accountId: z.string().uuid(),
  type: z.enum(['income', 'expense']),
  amount: z.coerce.number().positive(),
  currency: z.string().length(3),
  categoryId: z.string().uuid().optional(),
  note: z.string().max(500).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isRecurring: z.coerce.boolean().default(false),
})

export async function GET(req: NextRequest) {
  const auth = await resolveSession(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const accountId = searchParams.get('accountId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const limit = Math.min(Number(searchParams.get('limit') ?? 100), 500)

  const conditions: SQL[] = [
    eq(transactions.userId, auth.userId),
    isNull(transactions.deletedAt),
  ]
  if (type) conditions.push(eq(transactions.type, type as 'income' | 'expense'))
  if (accountId) conditions.push(eq(transactions.accountId, accountId))
  if (from) conditions.push(gte(transactions.date, from))
  if (to) conditions.push(lte(transactions.date, to))

  const rows = await db.select().from(transactions)
    .where(and(...conditions as [SQL, ...SQL[]]))
    .limit(limit)
    .orderBy(transactions.date)

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const auth = await resolveSession(req)
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  const parsed = createSchema.safeParse({
    ...body,
    currency: String(body.currency ?? '').toUpperCase(),
  })
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const d = parsed.data

  const accountCheck = await db.query.accounts.findFirst({
    where: and(eq(accounts.id, d.accountId), eq(accounts.userId, auth.userId), isNull(accounts.deletedAt)),
  })
  if (!accountCheck) return NextResponse.json({ error: 'Account not found or not yours' }, { status: 400 })

  if (d.categoryId) {
    const catCheck = await db.query.categories.findFirst({
      where: and(
        eq(categories.id, d.categoryId),
        isNull(categories.deletedAt),
        or(eq(categories.userId, auth.userId), isNull(categories.userId)),
      ),
    })
    if (!catCheck) return NextResponse.json({ error: 'Category not found or not yours' }, { status: 400 })
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, auth.userId) })
  const baseCurrency = user?.defaultCurrency ?? 'INR'
  const rate = await getRate(d.currency, baseCurrency)

  const [row] = await db.insert(transactions).values({
    ...d,
    userId: auth.userId,
    amount: String(d.amount),
    convertedAmount: String(d.amount * rate),
    baseCurrency,
  }).returning()

  revalidatePath('/transactions')
  revalidatePath('/dashboard')
  revalidatePath('/reports/cash-flow')
  revalidatePath('/reports/category-breakdown')
  revalidatePath('/reports/budget-vs-actual')
  revalidatePath('/networth')
  revalidatePath('/budgets')
  return NextResponse.json(row, { status: 201 })
}
