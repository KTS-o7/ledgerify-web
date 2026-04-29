import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { ProfileForm } from '@/components/settings/ProfileForm'
import { IconBadge, SectionHeader } from '@/components/shared/quiet-ledger'
import { Globe2, ShieldCheck } from 'lucide-react'

export default async function ProfilePage() {
  const session = await auth()
  const userId = session!.user!.id!

  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  const user = rows[0]

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="rounded-3xl border bg-card/85 p-5 shadow-sm shadow-foreground/5">
        <SectionHeader
          title="Profile"
          description="These defaults shape currency display, date handling, and setup guidance across your private ledger."
        />
        <div className="mt-5">
          <ProfileForm
            name={user.name}
            defaultCurrency={user.defaultCurrency}
            timezone={user.timezone}
          />
        </div>
      </div>

      <aside className="rounded-3xl border bg-card/70 p-5 shadow-sm shadow-foreground/5">
        <IconBadge icon={ShieldCheck} tone="positive" />
        <div className="mt-4 space-y-2">
          <h2 className="text-base font-semibold tracking-tight">
            Private by default
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Profile settings stay focused on local money behavior. Keep the home
            currency familiar for family members who will scan the app quickly.
          </p>
        </div>
        <div className="mt-5 rounded-2xl bg-muted/50 p-3 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <Globe2 className="size-4 text-primary" />
            {user.timezone}
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Used for date-sensitive summaries and setup pacing.
          </p>
        </div>
      </aside>
    </section>
  )
}
