'use client'
import { useActionState } from 'react'
import { updateProfile } from '@/app/actions/settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ProfileFormProps {
  name: string
  defaultCurrency: string
  timezone: string
}

export function ProfileForm({ name, defaultCurrency, timezone }: ProfileFormProps) {
  const [state, action, pending] = useActionState(updateProfile, null)

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-1">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={name} required placeholder="Your name" />
      </div>
      <div className="grid gap-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
        <div className="space-y-1">
          <Label htmlFor="defaultCurrency">Currency</Label>
          <Input
            id="defaultCurrency"
            name="defaultCurrency"
            defaultValue={defaultCurrency}
            maxLength={3}
            required
            className="uppercase"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="timezone">Timezone</Label>
          <Input
            id="timezone"
            name="timezone"
            defaultValue={timezone}
            required
            placeholder="Asia/Kolkata"
          />
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" disabled={pending} className="rounded-2xl">
          {pending ? 'Saving...' : 'Save profile'}
        </Button>
        {state && 'error' in state && state.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
        {state && 'success' in state && state.success && (
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            Profile updated.
          </p>
        )}
      </div>
    </form>
  )
}
