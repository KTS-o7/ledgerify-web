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
    <form action={action} className="space-y-4 max-w-sm">
      <div className="space-y-1">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={name} required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="defaultCurrency">Default Currency</Label>
        <Input id="defaultCurrency" name="defaultCurrency" defaultValue={defaultCurrency} maxLength={3} required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="timezone">Timezone</Label>
        <Input id="timezone" name="timezone" defaultValue={timezone} required />
      </div>
      {state && 'error' in state && state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      {state && 'success' in state && state.success && (
        <p className="text-sm text-green-600">Profile updated successfully.</p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </Button>
    </form>
  )
}
