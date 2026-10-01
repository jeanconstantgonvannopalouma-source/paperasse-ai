'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Sparkles, Check, ShieldCheck, ArrowRight, Loader2,
  FileSpreadsheet, TrendingUp, Bot, Zap, CheckCircle2, LayoutDashboard,
  Building2, Receipt, HardHat, BarChart3, Lock
} from 'lucide-react'

export default function HomePage() {
  const router = useRouter()
  const supabase = createClient()

  const [user, setUser] = useState<any>(null)
  const [loadingCheckout, setLoadingCheckout] = useState(false)
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month')

  useEffect(() => {
    async function checkAuth() {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        if (currentUser) setUser(currentUser)
      } catch (e) {}
    }
    checkAuth()
  }, [supabase])

  const handleStartTrial = async () => {
    if (user) {
      router.push('/dashboard')
      return
    }

    setLoadingCheckout(true)
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval: billingInterval }),
      })

      const data = await res.json()

      if (res.status === 401) {
        router.push('/signup?redirectTo=/pricing')
        return
      }

      if (data.url) {
        window.location.href = data.url
      } else {
        router.push('/signup')
      }
    } catch (err) {
      router.push('/signup')
    } finally {
      setLoadingCheckout(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-amber-500 selection:text-slate-950 font-sans">
      
      {/* NAVBAR */}
      <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-amber-600 to-amber-400 rounded-xl text-slate-950 font-black shadow-lg shadow-amber-500/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <span className="font-black text-xl tracking-tight text-white block leading-none">Paperasse.ai</span>
              <span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest">Pré-comptabilité BTP</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-300">
            <a href="#fonctionnalites" className="hover:text-amber-400 transition-colors">Fonctionnalités</a>
            <a href="#marge" className="hover:text-amber-400 transition-colors">Calcul de Marge</a>
            <a href="#tarifs" className="hover:text-amber-400 transition-colors">Tarifs</a>
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <Link href="/dashboard">
                <Button size="sm" className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold gap-2 text-xs sm:text-sm shadow-lg shadow-amber-500/20 border border-amber-400/50">
                  <LayoutDashboard className="h-4 w-4" />
                  Mon Tableau de Bord
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-800 text-xs sm:text-sm font-semibold">
                    Se connecter
                  </Button>
                </Link>
                <Button
                  onClick={handleStartTrial}
                  size="sm"
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold shadow-lg shadow-amber-500/20 gap-2 text-xs sm:text-sm"
                >
                  Essai Gratuit 14 jours
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative overflow-hidden pt-16 pb-24 lg:pt-28 lg:pb-36 border-b border-slate-800/80">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(245,158,11,0.18),rgba(255,255,255,0))]" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-8">
          
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs sm:text-sm font-bold shadow-inner">
            <Sparkles className="h-4 w-4" />
            La plateforme de gestion financière dédiée aux entreprises du BTP
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight max-w-4xl mx-auto leading-[1.08]">
            Divisez par 4 le temps passé sur votre <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500">paperasse BTP</span>.
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
            Automatisez la saisie de vos achats BTP, pilotez la rentabilité réelle de vos chantiers au centime près et transmettez un fichier FEC 100% conforme à votre comptable.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            {user ? (
              <Link href="/dashboard" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-slate-950 font-black h-14 px-8 text-base rounded-2xl shadow-xl shadow-amber-500/20 gap-3">
                  <LayoutDashboard className="h-5 w-5" />
                  Accéder à mon Espace
                </Button>
              </Link>
            ) : (
              <Button
                onClick={handleStartTrial}
                disabled={loadingCheckout}
                className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-slate-950 font-black h-14 px-8 text-base rounded-2xl shadow-xl shadow-amber-500/20 gap-3 transition-transform active:scale-95"
              >
                {loadingCheckout ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Démarrer mes 14 jours d'essai gratuit <ArrowRight className="h-5 w-5" /></>}
              </Button>
            )}
            
            <a href="#fonctionnalites">
              <Button variant="outline" className="w-full sm:w-auto border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-200 hover:text-white h-14 px-6 text-base rounded-2xl font-bold backdrop-blur-sm transition-colors">
                Découvrir les fonctionnalités
              </Button>
            </a>
          </div>

          <div className="pt-8 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs text-slate-400 font-semibold border-t border-slate-800/60 max-w-3xl mx-auto">
            <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Essai gratuit sans engagement</span>
            <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Conforme Norme DGFiP & FEC</span>
            <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Sécurité chiffrée & RLS</span>
          </div>
        </div>
      </section>

      {/* LOGOS COMPATIBILITÉ BTP */}
      <section className="bg-slate-900/50 border-b border-slate-800 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center space-y-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Compatible avec vos fournisseurs BTP et cabinets d'expertise comptable
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-14 opacity-50 font-black text-sm text-slate-300 tracking-wider">
            <span>POINT P</span>
            <span>LEROY MERLIN</span>
            <span>SAINT-GOBAIN</span>
            <span>CEDEO</span>
            <span>REXEL</span>
            <span>CEGID</span>
            <span>SAGE</span>
            <span>PENNYLANE</span>
          </div>
        </div>
      </section>

      {/* LES 3 PILIERS DÉTAILLÉS */}
      <section id="fonctionnalites" className="py-20 lg:py-28 max-w-7xl mx-auto px-4 sm:px-6 space-y-16">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Tout votre suivi financier au même endroit.
          </h2>
          <p className="text-slate-400 text-base">
            Développé avec des artisans pour répondre aux exigences réelles du terrain.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-xl space-y-4 relative overflow-hidden group hover:border-amber-500/50 transition-colors">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl w-max">
              <Bot className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-bold text-white">Scan IA & Extractions</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Photographiez vos tickets de caisse et factures fournisseurs. L'IA extrait automatiquement les montants HT, TVA multi-taux et références pièces.
            </p>
          </div>

          <div id="marge" className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-xl space-y-4 relative overflow-hidden group hover:border-emerald-500/50 transition-colors">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl w-max">
              <TrendingUp className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-bold text-white">Marge Brute par Chantier</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Rattachez chaque dépense à un chantier spécifique. Suivez le pourcentage de marge brute en temps réel pour piloter la rentabilité de vos travaux.
            </p>
          </div>

          <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-xl space-y-4 relative overflow-hidden group hover:border-purple-500/50 transition-colors">
            <div className="p-3 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-2xl w-max">
              <FileSpreadsheet className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-bold text-white">Exports FEC Normés DGFiP</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Générez en 1 clic le Fichier des Écritures Comptables conforme (18 colonnes). Donnez un accès sécurisé chiffré à votre expert-comptable.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION TARIFS RESTRUCTURÉE */}
      <section id="tarifs" className="py-20 lg:py-28 bg-slate-900/60 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
          
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <Zap className="h-3.5 w-3.5" /> Offre claire & sans engagement
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
              Une formule tout-inclus, conçue pour le BTP.
            </h2>
            <p className="text-slate-400 text-base">
              Accédez à l'intégralité de la plateforme gratuitement pendant 14 jours.
            </p>

            <div className="pt-4 flex items-center justify-center gap-3">
              <span className={`text-sm font-medium ${billingInterval === 'month' ? 'text-white font-bold' : 'text-slate-400'}`}>
                Facturation Mensuelle
              </span>
              <button
                type="button"
                onClick={() => setBillingInterval(billingInterval === 'month' ? 'year' : 'month')}
                className="relative w-14 h-8 bg-slate-800 rounded-full p-1 border border-slate-700 transition-colors focus:outline-none"
              >
                <div className={`w-6 h-6 bg-amber-500 rounded-full shadow-md transition-transform transform ${billingInterval === 'year' ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
              <span className={`text-sm font-medium flex items-center gap-1.5 ${billingInterval === 'year' ? 'text-white font-bold' : 'text-slate-400'}`}>
                Facturation Annuelle
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  2 mois offerts
                </span>
              </span>
            </div>
          </div>

          <div className="bg-slate-950 rounded-3xl border-2 border-amber-500/50 shadow-2xl p-8 sm:p-10 space-y-8 max-w-xl mx-auto relative overflow-hidden">
            <div className="flex items-start justify-between border-b border-slate-800 pb-6">
              <div>
                <h3 className="text-2xl font-black text-white">Forfait Pro BTP</h3>
                <p className="text-xs text-slate-400 mt-1">Accès complet à toutes les fonctionnalités</p>
              </div>
              <div className="text-right">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl sm:text-5xl font-black text-white">
                    {billingInterval === 'month' ? '39 €' : '32,50 €'}
                  </span>
                  <span className="text-slate-400 text-sm">/ mois</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {billingInterval === 'year' ? '390 € HT facturés par an' : 'Sans engagement de durée'}
                </p>
              </div>
            </div>

            <div className="space-y-3 text-sm text-slate-300">
              <div className="flex items-center gap-3"><Check className="h-4 w-4 text-emerald-400 shrink-0" /><span><strong>Scan IA & OCR illimités</strong> (Tickets & Factures)</span></div>
              <div className="flex items-center gap-3"><Check className="h-4 w-4 text-emerald-400 shrink-0" /><span><strong>Suivi de Marge Brute</strong> par Chantier</span></div>
              <div className="flex items-center gap-3"><Check className="h-4 w-4 text-emerald-400 shrink-0" /><span><strong>Création Devis & Factures BTP</strong> (Décennale, Autoliquidation)</span></div>
              <div className="flex items-center gap-3"><Check className="h-4 w-4 text-emerald-400 shrink-0" /><span><strong>Exports FEC normés DGFiP</strong> (Sage, Cegid, Pennylane)</span></div>
              <div className="flex items-center gap-3"><Check className="h-4 w-4 text-emerald-400 shrink-0" /><span><strong>Lien d'accès sécurisé</strong> pour l'Expert-Comptable</span></div>
            </div>

            <Button
              onClick={handleStartTrial}
              disabled={loadingCheckout}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black h-14 text-base rounded-2xl shadow-xl gap-2 transition-transform active:scale-98"
            >
              {loadingCheckout ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  {user ? 'Accéder à mon tableau de bord' : 'Démarrer mes 14 jours d\'essai gratuit'}
                </>
              )}
            </Button>

            <div className="flex items-center justify-center gap-4 text-xs text-slate-400 pt-2 border-t border-slate-800">
              <span className="flex items-center gap-1"><ShieldCheck className="h-4 w-4 text-amber-400" /> Paiement sécurisé par Stripe</span>
              <span>•</span>
              <span>Annulable à tout moment</span>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-950 border-t border-slate-800 py-10 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} Paperasse.ai — Solution de pré-comptabilité et facturation BTP. Tous droits réservés.</p>
      </footer>
    </div>
  )
}