import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/config'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (session?.user?.id) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center justify-center">
        <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-center">
          <div className="hidden space-y-5 lg:block">
            <div className="inline-flex rounded-full border bg-card/70 px-3 py-1 text-xs font-medium text-primary">
              Quiet Ledger
            </div>
            <div className="space-y-3">
              <h1
                data-display-text
                className="max-w-xl text-4xl font-bold tracking-tight text-foreground"
              >
                Your private money home for everyday clarity.
              </h1>
              <p className="max-w-lg text-base leading-7 text-muted-foreground">
                Track cash flow, accounts, budgets, goals, wealth, and obligations in
                a calm space built for personal and family use.
              </p>
            </div>
            <div className="grid max-w-lg gap-3 text-sm text-muted-foreground">
              <div className="rounded-3xl border bg-card/70 p-4">
                Daily transactions stay quick to capture.
              </div>
              <div className="rounded-3xl border bg-card/70 p-4">
                Planning, protection, and wealth views stay easy to scan.
              </div>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
