import { auth } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/shared/Sidebar'
import { BottomNav } from '@/components/shared/BottomNav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/auth/login')

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <Sidebar className="hidden md:flex md:flex-col" />

      {/* Main content — add bottom padding on mobile for bottom nav */}
      <main className="flex-1 min-w-0 pb-16 md:pb-0 overflow-y-auto">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <BottomNav className="md:hidden" />
    </div>
  )
}
