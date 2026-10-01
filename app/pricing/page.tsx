'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Check,
  Sparkles,
  ShieldCheck,
  ArrowLeft,
  Loader2,
  Building2,
  Receipt,
  HardHat,
  FileSpreadsheet,
  Users,
  HelpCircle,
} from 'lucide-react'

export default function PricingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month')
  const [error, setError] = useState<string | null>(null)

  const handleSubscribe = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval: billingInterval }),
      })

      const data = await res.json()

      if (res.status === 401) {
        // Si l'artisan n'est pas encore connecté, redirection vers l'inscription
        router.push('/signup?redirectTo=/pricing')
        return
      }

      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors du lancement de la commande')
      }

      if (data.url) {
        window.location.href = data.url
      }
    } catch (err: unknown) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Impossible d\'ouvrir le paiement Stripe')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950">
      {/* Header minimaliste */}
      <header className="max-w-7xl mx-auto w-full px-6 py-6 flex items-center justify-between border-b border-slate-800">
        <Link href="/dashboard" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium">
          <ArrowLeft className="h-4 w-4" />
          <span>Retour à l'application</span>
        </Link>

        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-500 rounded-lg text-slate-950 font-bold">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="font-extrabold text-lg text-white tracking-tight">Paperasse.ai</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-6 py-12 lg:py-16 space-y-12">
        {/* Titre & Accroche */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5" />
            14 jours d'essai gratuit — Sans engagement
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Pilotez votre rentabilité BTP sans perdre de temps.
          </h1>
          <p className="text-slate-400 text-base sm:text-lg">
            Scan IA illimité, calcul de marge par chantier en temps réel et exports FEC conformes pour votre expert-comptable.
          </p>
        </div>

        {/* Toggle Mensuel / Annuel */}
        <div className="flex items-center justify-center gap-3">
          <span className={`text-sm font-medium ${billingInterval === 'month' ? 'text-white font-bold' : 'text-slate-400'}`}>
            Facturation Mensuelle
          </span>
          <button
            type="button"
            onClick={() => setBillingInterval(billingInterval === 'month' ? 'year' : 'month')}
            className="relative w-14 h-8 bg-slate-800 rounded-full p-1 border border-slate-700 transition-colors focus:outline-none"
          >
            <div
              className={`w-6 h-6 bg-amber-500 rounded-full shadow-md transition-transform transform ${
                billingInterval === 'year' ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
          <span className={`text-sm font-medium flex items-center gap-1.5 ${billingInterval === 'year' ? 'text-white font-bold' : 'text-slate-400'}`}>
            Facturation Annuelle
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              2 mois offerts
            </span>
          </span>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* Carte de Tarif Unique BTP */}
        <div className="bg-slate-900 rounded-3xl border-2 border-amber-500/50 shadow-2xl p-8 sm:p-10 space-y-8 relative overflow-hidden max-w-xl mx-auto">
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-start justify-between border-b border-slate-800 pb-6">
            <div>
              <h3 className="text-xl font-black text-white">Forfait Pro BTP</h3>
              <p className="text-xs text-slate-400 mt-1">Tout ce dont votre entreprise BTP a besoin</p>
            </div>
            <div className="text-right">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl sm:text-5xl font-black text-white">
                  {billingInterval === 'month' ? '39 €' : '32.50 €'}
                </span>
                <span className="text-slate-400 text-sm">/ mois</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {billingInterval === 'year' ? '390 € HT facturés annuellement' : 'Facturé mensuellement • Sans engagement'}
              </p>
            </div>
          </div>

          {/* Fonctionnalités Clés */}
          <div className="space-y-3 text-sm text-slate-300">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Inclus dans votre abonnement :</p>

            <div className="flex items-center gap-3">
              <div className="p-1 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0">
                <Check className="h-4 w-4" />
              </div>
              <span><strong>Scan & OCR par IA illimités</strong> (Tickets Point P, Leroy Merlin...)</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-1 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0">
                <Check className="h-4 w-4" />
              </div>
              <span><strong>Suivi de Marge par Chantier</strong> en temps réel</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-1 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0">
                <Check className="h-4 w-4" />
              </div>
              <span><strong>Édition Devis & Factures BTP</strong> (Décennale, Autoliquidation TVA)</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-1 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0">
                <Check className="h-4 w-4" />
              </div>
              <span><strong>Rapprochement Bancaire automatique</strong> (Relevés CSV)</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-1 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0">
                <Check className="h-4 w-4" />
              </div>
              <span><strong>Export FEC Conforme DGFiP</strong> (Cegid, Sage, Pennylane)</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-1 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0">
                <Check className="h-4 w-4" />
              </div>
              <span><strong>Portail d'Accès Sécurisé</strong> pour votre Expert-Comptable</span>
            </div>
          </div>

          {/* Bouton d'action CTA */}
          <Button
            onClick={handleSubscribe}
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold h-14 text-base rounded-2xl shadow-lg transition-transform active:scale-[0.99] gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Ouverture du paiement sécurisé Stripe...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Démarrer mes 14 jours d'essai gratuit
              </>
            )}
          </Button>

          <div className="flex items-center justify-center gap-4 text-xs text-slate-400 pt-2 border-t border-slate-800">
            <span className="flex items-center gap-1"><ShieldCheck className="h-4 w-4 text-amber-400" /> Paiement sécurisé Stripe</span>
            <span>•</span>
            <span>Résiliation en 1 clic</span>
          </div>
        </div>

        {/* FAQ Rapide BTP */}
        <div className="pt-8 border-t border-slate-800 max-w-3xl mx-auto space-y-6">
          <h3 className="text-xl font-bold text-white text-center flex items-center justify-center gap-2">
            <HelpCircle className="h-5 w-5 text-amber-500" />
            Questions fréquentes
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div className="bg-slate-900/50 p-5 rounded-2xl border border-slate-800 space-y-1">
              <p className="font-bold text-white">Puis-je changer d'avis ?</p>
              <p className="text-slate-400 text-xs leading-relaxed">Oui. Vos 14 premiers jours sont 100% gratuits. Si l'outil ne vous convient pas, vous résiliez en 1 clic sans débourser un centime.</p>
            </div>

            <div className="bg-slate-900/50 p-5 rounded-2xl border border-slate-800 space-y-1">
              <p className="font-bold text-white">Mon comptable pourra-t-il l'utiliser ?</p>
              <p className="text-slate-400 text-xs leading-relaxed">Absolument. Vous pouvez lui transmettre son lien d'accès sécurisé pour qu'il télécharge le FEC normé et vos justificatifs chaque mois.</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} Paperasse.ai — Solution de pré-comptabilité & facturation dédiée aux entreprises du BTP.</p>
      </footer>
    </div>
  )
}