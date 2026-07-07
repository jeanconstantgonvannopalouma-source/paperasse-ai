'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'

const LEGAL_FORMS = [
  { value: 'micro', label: 'Micro-entreprise' },
  { value: 'ei', label: 'Entreprise individuelle' },
  { value: 'eurl', label: 'EURL' },
  { value: 'sarl', label: 'SARL' },
  { value: 'sasu', label: 'SASU' },
  { value: 'sas', label: 'SAS' },
  { value: 'other', label: 'Autre' },
]

const INDUSTRIES = [
  { value: 'electricite', label: 'Électricité' },
  { value: 'plomberie', label: 'Plomberie / Chauffage' },
  { value: 'maconnerie', label: 'Maçonnerie / Gros œuvre' },
  { value: 'peinture', label: 'Peinture / Revêtements' },
  { value: 'menuiserie', label: 'Menuiserie / Charpente' },
  { value: 'couverture', label: 'Couverture / Toiture' },
  { value: 'carrelage', label: 'Carrelage / Sols' },
  { value: 'renovation', label: 'Rénovation générale' },
  { value: 'other', label: 'Autre métier' },
]

const VAT_REGIMES = [
  { value: 'franchise', label: 'Franchise en base de TVA (pas de TVA)' },
  { value: 'standard', label: 'TVA applicable' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()

  const [userId, setUserId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [legalForm, setLegalForm] = useState('')
  const [industry, setIndustry] = useState('')
  const [siret, setSiret] = useState('')
  const [vatRegime, setVatRegime] = useState('standard')
  const [accountantEmail, setAccountantEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      setUserId(user.id)

      // Vérifier si l'utilisateur a déjà une entreprise
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (profile?.company_id) {
        router.push('/dashboard')
      }
    }

    checkUser()
  }, [supabase, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!userId) return

    setLoading(true)
    setError(null)

    // Créer l'entreprise
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert({
        name: companyName,
        legal_form: legalForm || null,
        industry: industry || null,
        siret: siret || null,
        vat_regime: vatRegime,
        accountant_email: accountantEmail || null,
      })
      .select()
      .single()

    if (companyError) {
      setError('Erreur lors de la création de l\'entreprise')
      setLoading(false)
      return
    }

    // Associer l'entreprise au profil
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ company_id: company.id })
      .eq('id', userId)

    if (profileError) {
      setError('Erreur lors de l\'association du profil')
      setLoading(false)
      return
    }

    // Créer un abonnement gratuit par défaut
    await supabase.from('subscriptions').insert({
      company_id: company.id,
      plan: 'free',
      status: 'active',
    })

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Configurez votre entreprise</CardTitle>
          <CardDescription>
            Ces informations nous aident à personnaliser votre expérience
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md">
                {error}
              </div>
            )}

            {/* Nom de l'entreprise */}
            <div className="space-y-2">
              <Label htmlFor="companyName">
                Nom de l'entreprise <span className="text-red-500">*</span>
              </Label>
              <Input
                id="companyName"
                type="text"
                placeholder="Dupont Électricité"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
              />
            </div>

            {/* Forme juridique */}
            <div className="space-y-2">
              <Label htmlFor="legalForm">Forme juridique</Label>
              <Select value={legalForm} onValueChange={setLegalForm}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {LEGAL_FORMS.map((form) => (
                    <SelectItem key={form.value} value={form.value}>
                      {form.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Secteur d'activité */}
            <div className="space-y-2">
              <Label htmlFor="industry">Secteur d'activité</Label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((ind) => (
                    <SelectItem key={ind.value} value={ind.value}>
                      {ind.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* SIRET */}
            <div className="space-y-2">
              <Label htmlFor="siret">Numéro SIRET (optionnel)</Label>
              <Input
                id="siret"
                type="text"
                placeholder="123 456 789 00012"
                value={siret}
                onChange={(e) => setSiret(e.target.value)}
                maxLength={17}
              />
            </div>

            {/* Régime TVA */}
            <div className="space-y-2">
              <Label htmlFor="vatRegime">Régime de TVA</Label>
              <Select value={vatRegime} onValueChange={setVatRegime}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VAT_REGIMES.map((regime) => (
                    <SelectItem key={regime.value} value={regime.value}>
                      {regime.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Email comptable */}
            <div className="space-y-2">
              <Label htmlFor="accountantEmail">Email de votre comptable (optionnel)</Label>
              <Input
                id="accountantEmail"
                type="email"
                placeholder="comptable@cabinet.fr"
                value={accountantEmail}
                onChange={(e) => setAccountantEmail(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Pour envoyer vos exports directement à votre comptable
              </p>
            </div>
          </CardContent>

          <div className="p-6 pt-0">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Commencer à utiliser Paperasse.ai
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
