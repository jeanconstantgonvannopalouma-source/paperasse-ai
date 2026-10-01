'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard,
  FileText,
  Receipt,
  HardHat,
  DollarSign,
  Landmark,
  Download,
  Settings,
  Users,
  LogOut,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'

const navigation = [
  { name: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Documents', href: '/documents', icon: FileText },
  { name: 'Factures & Devis', href: '/factures', icon: Receipt },
  { name: 'Chantiers', href: '/chantiers', icon: HardHat },
  { name: 'Transactions', href: '/transactions', icon: DollarSign },
  { name: 'Banque', href: '/banque', icon: Landmark },
  { name: 'Clients', href: '/clients', icon: Users },
  { name: 'Exports', href: '/exports', icon: Download },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col justify-between min-h-screen p-4 border-r border-slate-800">
      <div className="space-y-6">
        {/* Brand */}
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="p-2 bg-amber-500 rounded-xl text-slate-950 font-bold">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-white leading-none">Paperasse AI</h1>
            <p className="text-[11px] text-slate-400 mt-1">Pré-comptabilité BTP</p>
          </div>
        </div>

        {/* Menu Principal */}
        <nav className="space-y-1">
          <p className="px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Menu principal
          </p>
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
            const Icon = item.icon

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-4 w-4 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                  <span>{item.name}</span>
                </div>
                {isActive && <ChevronRight className="h-4 w-4 text-slate-950" />}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Profil & Paramètres */}
      <div className="space-y-3 pt-4 border-t border-slate-800">
        <Link
          href="/settings"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            pathname === '/settings'
              ? 'bg-amber-500 text-slate-950 font-semibold'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Settings className="h-4 w-4 text-slate-400" />
          <span>Paramètres</span>
        </Link>

        <div className="flex items-center justify-between px-3 py-2 bg-slate-800/60 rounded-xl text-xs">
          <div className="truncate mr-2">
            <p className="font-semibold text-slate-200 truncate">{user?.email || 'Artisan'}</p>
          </div>
          <button
            onClick={handleSignOut}
            title="Déconnexion"
            className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
