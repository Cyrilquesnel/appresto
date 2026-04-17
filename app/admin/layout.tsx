import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const metadata = {
  title: 'Admin — Le Rush',
}

const NAV_ITEMS = [
  { href: '/admin', label: "Vue d'ensemble" },
  { href: '/admin/prospection', label: 'Prospection' },
] as const

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  if (user.email !== process.env.ADMIN_EMAIL) {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-gray-800 flex flex-col py-6 px-4 gap-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4 px-2">
          Admin
        </p>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-md px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
          >
            {item.label}
          </Link>
        ))}
        <div className="mt-auto pt-6 border-t border-gray-800">
          <p className="px-2 text-xs text-gray-600 truncate">{user.email}</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  )
}
