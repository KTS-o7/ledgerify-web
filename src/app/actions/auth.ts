'use server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { redirect } from 'next/navigation'
import { signOut } from '@/lib/auth/config'

const registerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export async function registerUser(_: unknown, formData: FormData) {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const email = parsed.data.email.toLowerCase().trim()

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  })
  if (existing) return { error: 'Email already registered' }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12)
  await db.insert(users).values({
    name: parsed.data.name,
    email,
    passwordHash,
  })

  redirect('/auth/login')
}

export async function logoutUser() {
  await signOut({ redirectTo: '/auth/login' })
}
