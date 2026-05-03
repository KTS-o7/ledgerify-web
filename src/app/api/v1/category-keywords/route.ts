import { NextRequest, NextResponse } from 'next/server'
import { resolveSession } from '@/lib/api/auth'
import { db } from '@/lib/db'
import { categoryKeywords, categories } from '@/lib/db/schema'
import { eq, and, isNull, or } from 'drizzle-orm'
import { z } from 'zod'

const createSchema = z.object({
  categoryId: z.string().uuid(),
  keyword: z.string().min(1).max(100).toLowerCase(),
})

const bulkSchema = z.object({
  keywords: z.array(z.object({
    categoryId: z.string().uuid(),
    keyword: z.string().min(1).max(100),
  })).min(1),
})

export async function GET(req: NextRequest) {
  const auth = await resolveSession(req)
  if (auth instanceof NextResponse) return auth

  const rows = await db.select().from(categoryKeywords)
    .where(eq(categoryKeywords.userId, auth.userId))
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const auth = await resolveSession(req)
  if (auth instanceof NextResponse) return auth

  const body = await req.json()

  // Support both single and bulk insert
  if (body.keywords) {
    const parsed = bulkSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

    // Validate all categoryIds belong to user or are system categories
    for (const kw of parsed.data.keywords) {
      const cat = await db.query.categories.findFirst({
        where: and(
          eq(categories.id, kw.categoryId),
          isNull(categories.deletedAt),
          or(eq(categories.userId, auth.userId), isNull(categories.userId)),
        ),
      })
      if (!cat) return NextResponse.json({ error: `Category ${kw.categoryId} not found` }, { status: 400 })
    }

    const rows = await db.insert(categoryKeywords)
      .values(parsed.data.keywords.map(kw => ({
        userId: auth.userId,
        categoryId: kw.categoryId,
        keyword: kw.keyword.toLowerCase(),
      })))
      .onConflictDoNothing()
      .returning()
    return NextResponse.json(rows, { status: 201 })
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const cat = await db.query.categories.findFirst({
    where: and(
      eq(categories.id, parsed.data.categoryId),
      isNull(categories.deletedAt),
      or(eq(categories.userId, auth.userId), isNull(categories.userId)),
    ),
  })
  if (!cat) return NextResponse.json({ error: 'Category not found' }, { status: 400 })

  const [row] = await db.insert(categoryKeywords)
    .values({ userId: auth.userId, categoryId: parsed.data.categoryId, keyword: parsed.data.keyword.toLowerCase() })
    .returning()
  return NextResponse.json(row, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const auth = await resolveSession(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await db.delete(categoryKeywords)
    .where(and(eq(categoryKeywords.id, id), eq(categoryKeywords.userId, auth.userId)))
  return NextResponse.json({ ok: true })
}
