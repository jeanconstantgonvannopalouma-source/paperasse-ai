'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Sidebar } from './sidebar'
import { Plus, Menu, X, Sparkles, Lock, ArrowRight, Loader2, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [loadingAccess, setLoadingAccess] = useState(true)
  const [isLocked, setIsLocked] = useState(false)
  const [daysLeft, setDaysLeft] = useState<number | null>(null)

  useEffect(() => {
    async function checkSubscription() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setLoadingAccess(false)
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .maybeSingle()

        if (!profile?.organization_id) {
          setLoadingAccess(false)
          return
        }

        const { data: org } = await supabase
          .from('organizations')
          .select('created_at, subscription_status')
          .eq('id', profile.organization_id)
          .maybeSingle()

        if (org) {
          // Si l'abonnement est actif, on laisse passer
          if (org.subscription_status === 'active') {
            setIsLocked(false)
            setLoadingAccess(false)
            return
          }

          // Sinon on calcule la période d'essai de 14 jours
          const createdDate = new Date(org.created_at)
          const now = new Date()
          const diffTime = now.getTime() - createdDate.getTime()
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
          const remaining = 14 - diffDays

          if (remaining <= 0) {
            setIsLocked(true) // Période d'essai terminée
          } else {
            setDaysLeft(remaining) // Afficher le compte à rebours
          }
        }
      } catch (err) {
        console.error('Erreur vérification abonnement', err)
      } finally {
        setLoadingAccess(false)
      }
    }

    checkSubscription()
  }, [supabase, pathname])

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col md:flex-row relative">
      {/* PAYWALL OVERLAY (VERROUILLAGE) */}
      {isLocked && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8 sm:p-12 text-center space-y-6 shadow-2xl border border-gray-200">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <Lock className="h-10 w-10 text-amber-600" />
            </div>
            
            <div className="space-y-3">
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">Période d'essai terminée</h2>
              <p className="text-gray-500 text-sm leading-relaxed max-w-sm mx-auto">
                Vos 14 jours d'essai gratuit sont écoulés. Pour continuer à piloter vos chantiers et facturer vos clients, veuillez activer votre abonnement Pro BTP.
              </p>
            </div>

            <div className="pt-4">
              <Link href="/pricing">
                <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white font-black h-14 text-base rounded-xl shadow-lg gap-2">
                  Débloquer mon compte maintenant <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
            </div>
            
            <p className="text-xs text-gray-400 font-medium flex items-center justify-center gap-1.5 pt-2">
              <ShieldAlert className="h-4 w-4" /> Vos données sont conservées en sécurité.
            </p>
          </div>
        </div>
      )}

      {/* Sidebar Desktop */}
      <div className="hidden md:block shrink-0">
        <Sidebar />
      </div>

      {/* Header Mobile */}
      <div className="md:hidden bg-slate-900 text-white p-4 flex items-center justify-between sticky top-0 z-40 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-amber-500 rounded-lg text-slate-950 font-bold">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="font-bold text-base tracking-tight">Paperasse AI</span>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Drawer Mobile */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex flex-col p-4 animate-in fade-in">
          <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-500 rounded-lg text-slate-950 font-bold">
                <Sparkles className="h-4 w-4" />
              </div>
              <span className="font-bold text-lg text-white">Paperasse AI</span>
            </div>
            <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-slate-400 hover:text-white">
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto" onClick={() => setMobileMenuOpen(false)}>
            <Sidebar />
          </div>
        </div>
      )}

      {/* Contenu Principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar Desktop */}
        <header className="hidden md:flex h-16 items-center justify-between px-6 bg-white border-b border-gray-200/80 sticky top-0 z-30 shadow-2xs">
          <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
            <span>Tableau de bord</span>
            {pathname !== '/dashboard' && (
              <>
                <span>/</span>
                <span className="text-gray-900 font-bold capitalize">{pathname.replace('/', '').replace('-', ' ')}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Compte à rebours Essai Gratuit */}
            {daysLeft !== null && daysLeft <= 14 && daysLeft > 0 && !isLocked && (
              <div className="hidden lg:flex items-center gap-2 text-xs font-semibold px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
                <Clock className="h-3.5 w-3.5" />
                Il vous reste {daysLeft} jour{daysLeft > 1 ? 's' : ''} d'essai
                <Link href="/pricing" className="ml-2 underline text-amber-900 hover:text-amber-600">S'abonner</Link>
              </div>
            )}

            <Link href="/documents/upload">
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white font-bold gap-2 shadow-sm">
                <Plus className="h-4 w-4" />
                Nouveau document
              </Button>
            </Link>
          </div>
        </header>

        {/* Zone de page */}
        <main className={`flex-1 min-w-0 ${isLocked ? 'blur-sm pointer-events-none select-none' : ''}`}>
          {loadingAccess ? (
            <div className="flex items-center justify-center h-[50vh]">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  )
}