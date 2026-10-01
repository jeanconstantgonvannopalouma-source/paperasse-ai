'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Loader2, Save, Building2, User, CheckCircle2, AlertCircle, RefreshCw,
  Copy, ShieldCheck, CreditCard, Key, Check, Mail, Send
} from 'lucide-react'

interface OrganizationForm {
  name: string
  legal_form: string
  industry: string
  siret: string
  siren: string
  vat_number: string
  vat_regime: string
  tax_regime: string
  phone: string
  email: string
  website: string
  address: string
  city: string
  postal_code: string
  country: string
  accountant_email: string
  accountant_name: string
  accountant_access_token: string
  decennale_company: string
  decennale_policy: string
  iban: string
  bic: string
  bank_name: string
}

interface ProfileForm {
  full_name: string
  email: string
}

const LEGAL_FORMS = [
  { value: 'micro', label: 'Micro-entreprise' },
  { value: 'ei', label: 'Entreprise Individuelle (EI)' },
  { value: 'eurl', label: 'EURL' },
  { value: 'sarl', label: 'SARL' },
  { value: 'sasu', label: 'SASU' },
  { value: 'sas', label: 'SAS' },
  { value: 'other', label: 'Autre' },
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
  { value: 'other', label: 'Autre métier BTP' },
]

const VAT_REGIMES = [
  { value: 'franchise', label: 'Franchise en base de TVA (Art. 293 B du CGI)' },
  { value: 'standard', label: 'TVA Régime Réel Simplifié' },
  { value: 'reel', label: 'TVA Régime Réel Normal' },
]

const EMPTY_ORG: OrganizationForm = {
  name: '', legal_form: 'sarl', industry: 'renovation', siret: '', siren: '', vat_number: '',
  vat_regime: 'standard', tax_regime: 'IS', phone: '', email: '', website: '', address: '',
  city: '', postal_code: '', country: 'France', accountant_email: '', accountant_name: '',
  accountant_access_token: '', decennale_company: '', decennale_policy: '', iban: '', bic: '', bank_name: '',
}

export default function SettingsPage() {
  const { user } = useAuth()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [savingOrg, setSavingOrg] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [generatingToken, setGeneratingToken] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [orgForm, setOrgForm] = useState<OrganizationForm>(EMPTY_ORG)
  const [profileForm, setProfileForm] = useState<ProfileForm>({ full_name: '', email: '' })
  
  // État local pour afficher TOUJOURS le lien généré
  const [generatedPortalUrl, setGeneratedPortalUrl] = useState<string>('')

  const fetchSettings = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)

    try {
      const { data: profile } = await supabase.from('profiles').select('organization_id, full_name, email').eq('id', user.id).maybeSingle()
      setProfileForm({ full_name: profile?.full_name || '', email: profile?.email || user.email || '' })

      let orgId = profile?.organization_id || null
      if (!orgId) {
        const { data: anyOrg } = await supabase.from('organizations').select('id').limit(1).maybeSingle()
        orgId = anyOrg?.id || null
      }
      setOrganizationId(orgId)

      if (!orgId) { setOrgForm(EMPTY_ORG); setLoading(false); return }

      const { data: org } = await supabase.from('organizations').select('*').eq('id', orgId).maybeSingle()
      if (org) {
        setOrgForm({
          name: org.name || '', legal_form: org.legal_form || 'sarl', industry: org.industry || 'renovation',
          siret: org.siret || '', siren: org.siren || '', vat_number: org.vat_number || '', vat_regime: org.vat_regime || 'standard',
          tax_regime: org.tax_regime || '', phone: org.phone || '', email: org.email || '', website: org.website || '',
          address: org.address || '', city: org.city || '', postal_code: org.postal_code || '', country: org.country || 'France',
          accountant_email: org.accountant_email || '', accountant_name: org.accountant_name || '',
          accountant_access_token: org.accountant_access_token || '', decennale_company: org.decennale_company || '',
          decennale_policy: org.decennale_policy || '', iban: org.iban || '', bic: org.bic || '', bank_name: org.bank_name || '',
        })

        if (org.accountant_access_token) {
          const origin = typeof window !== 'undefined' ? window.location.origin : ''
          setGeneratedPortalUrl(`${origin}/expert-comptable/${org.accountant_access_token}`)
        } else if (orgId) {
          const origin = typeof window !== 'undefined' ? window.location.origin : ''
          setGeneratedPortalUrl(`${origin}/expert-comptable/${orgId}`)
        }
      }
    } catch (err: unknown) {
      setError('Impossible de charger vos paramètres')
    } finally {
      setLoading(false)
    }
  }, [user, supabase])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  async function handleSaveOrganization(e: React.FormEvent) {
    e.preventDefault()
    if (!orgForm.name.trim()) return setError("Le nom de l'entreprise est obligatoire")
    setSavingOrg(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/organization/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orgForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la sauvegarde')

      setSuccess('Informations enregistrées avec succès !')
      await fetchSettings()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur de sauvegarde")
    } finally {
      setSavingOrg(false)
    }
  }

  async function handleGenerateAccountantToken() {
    setGeneratingToken(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/accountant/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountantEmail: orgForm.accountant_email || 'comptable@cabinet.fr',
          accountantName: orgForm.accountant_name || 'Cabinet Comptable',
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur génération lien')

      if (data.portalUrl) {
        setGeneratedPortalUrl(data.portalUrl)
      }
      setSuccess('Lien sécurisé pour votre expert-comptable généré !')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur génération lien')
    } finally {
      setGeneratingToken(false)
    }
  }

  const handleSendAccountantEmail = async () => {
    if (!orgForm.accountant_email) {
      setError("Veuillez renseigner l'email du comptable.")
      return
    }
    setSendingEmail(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'accountant_invite',
          to: orgForm.accountant_email,
          accountantName: orgForm.accountant_name,
          portalUrl: generatedPortalUrl,
          companyName: orgForm.name || 'Votre entreprise BTP',
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Échec de l'envoi")

      setSuccess(`E-mail envoyé avec succès à ${orgForm.accountant_email} !`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur envoi email')
    } finally {
      setSendingEmail(false)
    }
  }

  const copyAccountantLink = () => {
    if (!generatedPortalUrl) return
    navigator.clipboard.writeText(generatedPortalUrl)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 3000)
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSavingProfile(true)
    try {
      await supabase.from('profiles').update({ full_name: profileForm.full_name.trim() || null }).eq('id', user.id)
      setSuccess('Profil utilisateur mis à jour')
    } catch (err) {
      setError('Erreur sauvegarde profil')
    } finally {
      setSavingProfile(false)
    }
  }

  if (loading) {
    return (
      <div className="p-24 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600 mx-auto" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paramètres Entreprise</h1>
          <p className="text-sm text-gray-500">Configurez vos informations légales et l'accès comptable.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchSettings} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualiser
        </Button>
      </div>

      {error && <div className="p-4 rounded-xl bg-red-50 text-red-700 text-sm flex gap-2"><AlertCircle className="h-5 w-5" />{error}</div>}
      {success && <div className="p-4 rounded-xl bg-emerald-50 text-emerald-700 text-sm flex gap-2 font-medium"><CheckCircle2 className="h-5 w-5" />{success}</div>}

      <form onSubmit={handleSaveOrganization} className="space-y-6 text-sm">
        <div className="bg-white rounded-2xl border p-6 space-y-4 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2"><Building2 className="h-5 w-5 text-amber-600"/> Identité & Coordonnées</h2>
          <div className="space-y-1.5">
            <Label>Raison Sociale *</Label>
            <Input value={orgForm.name} onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Forme juridique</Label>
              <Select value={orgForm.legal_form} onValueChange={(v) => setOrgForm({ ...orgForm, legal_form: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LEGAL_FORMS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Secteur BTP</Label>
              <Select value={orgForm.industry} onValueChange={(v) => setOrgForm({ ...orgForm, industry: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{INDUSTRIES.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><Label>SIRET</Label><Input value={orgForm.siret} onChange={(e) => setOrgForm({ ...orgForm, siret: e.target.value })} /></div>
            <div><Label>SIREN</Label><Input value={orgForm.siren} onChange={(e) => setOrgForm({ ...orgForm, siren: e.target.value })} /></div>
            <div><Label>N° TVA</Label><Input value={orgForm.vat_number} onChange={(e) => setOrgForm({ ...orgForm, vat_number: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Téléphone</Label><Input value={orgForm.phone} onChange={(e) => setOrgForm({ ...orgForm, phone: e.target.value })} /></div>
            <div><Label>Email entreprise</Label><Input type="email" value={orgForm.email} onChange={(e) => setOrgForm({ ...orgForm, email: e.target.value })} /></div>
          </div>
          <div><Label>Adresse</Label><Input value={orgForm.address} onChange={(e) => setOrgForm({ ...orgForm, address: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-4">
            <div><Label>CP</Label><Input value={orgForm.postal_code} onChange={(e) => setOrgForm({ ...orgForm, postal_code: e.target.value })} /></div>
            <div className="col-span-2"><Label>Ville</Label><Input value={orgForm.city} onChange={(e) => setOrgForm({ ...orgForm, city: e.target.value })} /></div>
          </div>
        </div>

        {/* SECTION ESPACE COMPTABLE AVEC AFFICHAGE CLAIR DU LIEN */}
        <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
          <h3 className="font-bold text-gray-900 text-base flex items-center gap-2"><Key className="h-5 w-5 text-purple-600" /> Portail Sécurisé Expert-Comptable</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nom du Cabinet / Comptable</Label>
              <Input value={orgForm.accountant_name} onChange={(e) => setOrgForm({ ...orgForm, accountant_name: e.target.value })} placeholder="ex: Cabinet Audit BTP" />
            </div>
            <div>
              <Label>Email du Comptable</Label>
              <Input type="email" value={orgForm.accountant_email} onChange={(e) => setOrgForm({ ...orgForm, accountant_email: e.target.value })} placeholder="comptable@cabinet.fr" />
            </div>
          </div>

          {/* BOX DU LIEN SÉCURISÉ */}
          {generatedPortalUrl ? (
            <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 space-y-2">
              <Label className="text-xs font-bold text-purple-900">Lien d'accès sécurisé pour votre comptable :</Label>
              <div className="flex gap-2">
                <Input readOnly value={generatedPortalUrl} className="bg-white font-mono text-xs text-gray-800" />
                <Button type="button" onClick={copyAccountantLink} variant="outline" className="gap-2 shrink-0">
                  {copiedLink ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  {copiedLink ? 'Copié !' : 'Copier'}
                </Button>
                <Button type="button" onClick={handleSendAccountantEmail} disabled={sendingEmail} className="bg-purple-600 hover:bg-purple-700 text-white gap-2 shrink-0 font-bold">
                  {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Envoyer par e-mail
                </Button>
              </div>
            </div>
          ) : (
            <Button type="button" onClick={handleGenerateAccountantToken} disabled={generatingToken} variant="outline" className="border-purple-200 text-purple-700 hover:bg-purple-50 gap-2 text-xs font-semibold">
              {generatingToken ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
              Générer le lien d'accès comptable
            </Button>
          )}
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={savingOrg} className="bg-amber-600 hover:bg-amber-700 text-white font-bold h-11 px-8">
            {savingOrg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer les modifications
          </Button>
        </div>
      </form>
    </div>
  )
}