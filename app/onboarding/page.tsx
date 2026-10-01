'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Sparkles,
  Building2,
  HardHat,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Check,
} from 'lucide-react'

const LEGAL_FORMS = [
  { value: 'micro', label: 'Micro-entreprise / Auto-entrepreneur' },
  { value: 'ei', label: 'Entreprise Individuelle (EI)' },
  { value: 'eurl', label: 'EURL' },
  { value: 'sarl', label: 'SARL' },
  { value: 'sasu', label: 'SASU' },
  { value: 'sas', label: 'SAS' },
]

const INDUSTRIES = [
  { value: 'electricite', label: 'Électricité' },
  { value: 'plomberie', label: 'Plomberie / Chauffage' },
  { value: 'maconnerie', label: 'Maçonnerie / Gros Œuvre' },
  { value: 'peinture', label: 'Peinture / Revêtements' },
  { value: 'menuiserie', label: 'Menuiserie / Charpente' },
  { value: 'couverture', label: 'Couverture / Toiture' },
  { value: 'carrelage', label: 'Carrelage / Sols' },
  { value: 'renovation', label: 'Rénovation Générale' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Données du formulaire
  const [companyName, setCompanyName] = useState('')
  const [siret, setSiret] = useState('')
  const [legalForm, setLegalForm] = useState('sarl')
  const [industry, setIndustry] = useState('renovation')
  const [phone, setPhone] = useState('')

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Si l'utilisateur a DÉJÀ une entreprise, on l'envoie direct au dashboard
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .maybeSingle()

      if (profile?.organization_id) {
        router.replace('/dashboard')
      } else {
        setCheckingAuth(false)
      }
    }
    init()
  }, [supabase, router])

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyName.trim()) {
      setError("Le nom de votre entreprise est obligatoire.")
      return
    }
    setError(null)
    setStep(2)
  }

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/organization/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: companyName.trim(),
          siret: siret.trim() || null,
          legal_form: legalForm,
          industry,
          phone: phone.trim() || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erreur lors de la création de l'entreprise")

      // Redirection immédiate vers le Dashboard configuré
      router.replace('/dashboard')
    } catch (err: unknown) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement")
      setLoading(false)
    }
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        <p className="text-xs text-slate-400 font-medium">Initialisation de votre espace...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950 font-sans">
      
      {/* HEADER */}
      <header className="max-w-4xl mx-auto w-full px-6 py-8 flex items-center justify-between border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500 rounded-xl text-slate-950 font-bold shadow-md">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <span className="font-extrabold text-xl text-white tracking-tight block leading-none">Paperasse.ai</span>
            <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">Configuration initiale</span>
          </div>
        </div>

        {/* Indicateur d'étape */}
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
            step >= 1 ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
          }`}>
            1
          </div>
          <div className="w-8 h-0.5 bg-slate-800" />
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
            step >= 2 ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
          }`}>
            2
          </div>
        </div>
      </header>

      {/* CONTENU DU TUNNEL */}
      <main className="max-w-xl mx-auto px-6 py-8 sm:py-12 w-full">
        <div className="bg-slate-900 rounded-3xl border border-slate-800 p-8 shadow-2xl space-y-6 relative overflow-hidden">
          
          <div className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Étape {step} sur 2</span>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {step === 1 ? 'Votre Entreprise BTP' : 'Votre Métier & Contact'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              {step === 1
                ? "Configurez l'identité légale de votre activité pour vos devis et factures."
                : "Aidez-nous à personnaliser votre tableau de bord financier."}
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === 1 ? (
            /* ÉTAPE 1 : IDENTITÉ ENTREPRISE */
            <form onSubmit={handleNextStep} className="space-y-4 text-sm">
              <div className="space-y-1.5">
                <Label htmlFor="companyName" className="text-slate-300">
                  Raison sociale / Nom de l'entreprise <span className="text-amber-500">*</span>
                </Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="ex: Plomberie du Rhône EURL"
                  required
                  className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 h-11 focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="siret" className="text-slate-300">
                  N° SIRET (14 chiffres - Optionnel)
                </Label>
                <Input
                  id="siret"
                  value={siret}
                  onChange={(e) => setSiret(e.target.value)}
                  placeholder="123 456 789 00012"
                  className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 font-mono h-11 focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-300">Forme juridique</Label>
                <Select value={legalForm} onValueChange={setLegalForm}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-white h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                    {LEGAL_FORMS.map((f) => (
                      <SelectItem key={f.value} value={f.value} className="focus:bg-amber-500 focus:text-slate-950">
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold h-12 rounded-xl shadow-md gap-2 mt-4"
              >
                Continuer <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          ) : (
            /* ÉTAPE 2 : SÉCTEUR & CONTACT */
            <form onSubmit={handleFinalSubmit} className="space-y-4 text-sm">
              <div className="space-y-1.5">
                <Label className="text-slate-300">Secteur d'activité principal</Label>
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-white h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                    {INDUSTRIES.map((i) => (
                      <SelectItem key={i.value} value={i.value} className="focus:bg-amber-500 focus:text-slate-950">
                        {i.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-slate-300">
                  Téléphone professionnel
                </Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="06 12 34 56 78"
                  className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 h-11 focus:border-amber-500"
                />
              </div>

              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>Vos 14 jours d'essai gratuit démarreront immédiatement après validation.</span>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  disabled={loading}
                  className="border-slate-800 text-slate-300 hover:bg-slate-800 h-12"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" /> Retour
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold h-12 rounded-xl shadow-md gap-2"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Check className="h-5 w-5" />
                      Accéder à mon Tableau de Bord
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} Paperasse.ai — Configuration sécurisée de votre espace BTP.</p>
      </footer>
    </div>
  )
}