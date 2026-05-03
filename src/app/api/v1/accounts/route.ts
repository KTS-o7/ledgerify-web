import { NextRequest, NextResponse } from 'next/server'
import { resolveSession } from '@/lib/api/auth'
import { db } from '@/lib/db'
import { accounts } from '@/lib/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

const createSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['bank', 'wallet', 'cash', 'savings', 'credit_card', 'investment']),
  currency: z.string().length(3),
  openingBalance: z.coerce.number().default(0),
  creditLimit: z.coerce.number().optional(),
  statementDay: z.coerce.number().int().min(1).max(28).optional(),
  paymentDueDay: z.coerce.number().int().min(1).max(28).optional(),
})

export async function GET(req: NextRequest) {
  const auth = await resolveSession(req)
  if (auth instanceof NextResponse) return auth

  const rows = await db.select().from(accounts)
    .where(and(eq(accounts.userId, auth.userId), isNull(accounts.deletedAt)))
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

  const { openingBalance, creditLimit, statementDay, paymentDueDay, ...rest } = parsed.data

  const [row] = await db.insert(accounts)
    .values({
      ...rest,
      userId: auth.userId,
      openingBalance: String(openingBalance),
      creditLimit: creditLimit != null ? String(creditLimit) : null,
      statementDay: statementDay != null ? String(statementDay) : null,
      paymentDueDay: paymentDueDay != null ? String(paymentDueDay) : null,
    })
    .returning()

  revalidatePath('/settings/accounts')
  revalidatePath('/dashboard')
  revalidatePath('/transactions')
  revalidatePath('/networth')
  revalidatePath('/reports/cash-flow')
  return NextResponse.json(row, { status: 201 })
}
