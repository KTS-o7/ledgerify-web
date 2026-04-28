import Link from 'next/link'

const tabs = [
  { href: '/settings/profile', label: 'Profile' },
  { href: '/settings/accounts', label: 'Accounts' },
  { href: '/settings/categories', label: 'Categories' },
  { href: '/settings/data', label: 'Data' },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      <nav className="flex gap-2 border-b pb-2">
        {tabs.map(t => (
          <Link key={t.href} href={t.href} className="text-sm px-3 py-1 rounded-md hover:bg-muted">
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  )
}
