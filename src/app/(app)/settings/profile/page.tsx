import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { ProfileForm } from '@/components/settings/ProfileForm'

export default async function ProfilePage() {
  const session = await auth()
  const userId = session!.user!.id!

  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  const user = rows[0]

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Profile</h2>
      <ProfileForm
        name={user.name}
        defaultCurrency={user.defaultCurrency}
        timezone={user.timezone}
      />
    </div>
  )
}
