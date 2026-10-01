'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  Plus,
  Trash2,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Building2,
  Users,
} from 'lucide-react'

interface InvoiceItem {
  designation: string
  quantity: number
  unitPrice: number
  vatRate: number
}

interface ChantierOption {
  id: string
  name: string
  client_name?: string | null
}

interface ClientOption {
  id: string
  name: string
  email: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  siret: string | null
}

function euro(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0)
}

function round2(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100
}

export default function NewInvoicePage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [chantiers, setChantiers] = useState<ChantierOption[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])

  const [docType, setDocType] = useState<'facture' | 'devis'>('facture')
  const [selectedClientId, setSelectedClientId] = useState('manual')
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientAddress, setClientAddress] = useState('')
  const [selectedChantier, setSelectedChantier] = useState('none')
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState('')
  const [isAutoliquidation, setIsAutoliquidation] = useState(false)
  const [decennaleCompany, setDecennaleCompany] = useState('')
  const [decennalePolicy, setDecennalePolicy] = useState('')
  const [notes, setNotes] = useState('')

  const [items, setItems] = useState<InvoiceItem[]>([
    { designation: "Main d'œuvre & travaux de rénovation", quantity: 1, unitPrice: 1500, vatRate: 10 },
    { designation: 'Fournitures / matériaux', quantity: 1, unitPrice: 500, vatRate: 20 },
  ])

  useEffect(() => {
    async function loadRefs() {
      const [{ data: ch }, { data: cl }] = await Promise.all([
        supabase.from('chantiers').select('id, name, client_name').order('created_at', { ascending: false }),
        supabase.from('clients').select('id, name, email, address, city, postal_code, siret').order('name', { ascending: true }),
      ])
      if (ch) setChantiers(ch)
      if (cl) setClients(cl)
    }
    loadRefs()
  }, [supabase])

  const handleSelectClient = (id: string) => {
    setSelectedClientId(id)
    if (id === 'manual') return
    const c = clients.find((x) => x.id === id)
    if (!c) return
    setClientName(c.name || '')
    setClientEmail(c.email || '')
    const addr = [c.address, c.postal_code, c.city].filter(Boolean).join(', ')
    setClientAddress(addr)
  }

  const addItem = () => {
    setItems((prev) => [...prev, { designation: '', quantity: 1, unitPrice: 0, vatRate: isAutoliquidation ? 0 : 20 }])
  }

  const removeItem = (index: number) => {
    if (items.length <= 1) return
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    setItems((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const totals = useMemo(() => {
    let ht = 0
    let vat = 0
    items.forEach((item) => {
      const lineHt = round2((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))
      const rate = isAutoliquidation ? 0 : Number(item.vatRate) || 0
      const lineVat = round2(lineHt * (rate / 100))
      ht += lineHt
      vat += lineVat
    })
    ht = round2(ht)
    vat = isAutoliquidation ? 0 : round2(vat)
    return { ht, vat, ttc: round2(ht + vat) }
  }, [items, isAutoliquidation])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!clientName.trim()) {
      setError('Veuillez renseigner le nom du client.')
      return
    }

    const validItems = items.filter((i) => (i.designation || '').trim() && Number(i.unitPrice) >= 0)
    if (validItems.length === 0) {
      setError('Ajoutez au moins une ligne de prestation avec une désignation.')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/invoices/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docType,
          clientName: clientName.trim(),
          clientEmail: clientEmail.trim() || null,
          clientAddress: clientAddress.trim() || null,
          chantierId: selectedChantier,
          issueDate,
          dueDate: dueDate || null,
          items: validItems.map((i) => ({
            designation: i.designation.trim(),
            description: i.designation.trim(),
            quantity: Number(i.quantity) || 1,
            unitPrice: Number(i.unitPrice) || 0,
            vatRate: isAutoliquidation ? 0 : Number(i.vatRate) || 0,
          })),
          isAutoliquidation,
          decennaleCompany: decennaleCompany.trim() || null,
          decennalePolicy: decennalePolicy.trim() || null,
          notes: notes.trim() || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la création')

      setSuccess(data.message)
      setTimeout(() => router.push('/transactions'), 1400)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la génération de la facture')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-4 border-b border-gray-100 pb-4">
        <Link href="/dashboard">
          <Button variant="outline" size="icon" className="h-9 w-9">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Créer un devis / une facture</h1>
          <p className="text-sm text-gray-500">Documents BTP conformes : TVA multi-taux, autoliquidation, décennale.</p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <h3 className="font-bold text-gray-900 text-base border-b pb-2 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-amber-600" />
            Informations générales & client
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Type de document *</Label>
              <Select value={docType} onValueChange={(val: 'facture' | 'devis') => setDocType(val)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="facture">Facture client</SelectItem>
                  <SelectItem value="devis">Devis travaux BTP</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Chantier associé</Label>
              <Select value={selectedChantier} onValueChange={setSelectedChantier}>
                <SelectTrigger><SelectValue placeholder="Choisir un chantier..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun chantier</SelectItem>
                  {chantiers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Client du carnet</Label>
            <Select value={selectedClientId} onValueChange={handleSelectClient}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un client existant..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Saisie manuelle</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}{c.siret ? ' (Pro)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nom / Raison sociale *</Label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="ex: M. Martin ou SARL Dupont" required />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="client@email.fr" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Adresse de facturation</Label>
              <Input value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} placeholder="Adresse complète" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Date d'émission</Label>
                <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Échéance</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-600 mt-0.5" />
              <div>
                <p className="font-semibold text-xs text-gray-900">Autoliquidation TVA (sous-traitance BTP)</p>
                <p className="text-[11px] text-gray-500">Art. 283-2 nonies du CGI — TVA forcée à 0 % + mention légale auto</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={isAutoliquidation}
              onChange={(e) => setIsAutoliquidation(e.target.checked)}
              className="h-4 w-4 text-amber-600 rounded border-gray-300 cursor-pointer"
            />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-600" />
              Prestations & fournitures
            </h3>
            <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" /> Ajouter une ligne
            </Button>
          </div>

          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-gray-50 p-3 rounded-xl border border-gray-200 text-sm">
                <div className="col-span-12 sm:col-span-5">
                  <Input
                    placeholder="Désignation des travaux ou fournitures..."
                    value={item.designation}
                    onChange={(e) => updateItem(idx, 'designation', e.target.value)}
                  />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Qté"
                    value={item.quantity}
                    onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="PU HT (€)"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="col-span-3 sm:col-span-2">
                  <Select
                    value={String(item.vatRate)}
                    onValueChange={(val) => updateItem(idx, 'vatRate', parseFloat(val))}
                    disabled={isAutoliquidation}
                  >
                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="20">TVA 20%</SelectItem>
                      <SelectItem value="10">TVA 10% (rénov.)</SelectItem>
                      <SelectItem value="5.5">TVA 5,5% (RGE)</SelectItem>
                      <SelectItem value="0">TVA 0%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-1 text-right">
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    disabled={items.length <= 1}
                    className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-end pt-4 border-t space-y-1 text-sm">
            <p className="text-gray-600">Total HT : <span className="font-bold text-gray-900">{euro(totals.ht)}</span></p>
            <p className="text-gray-600">Total TVA : <span className="font-bold text-gray-900">{euro(totals.vat)}</span></p>
            <p className="text-lg font-extrabold text-amber-700">Total TTC : {euro(totals.ttc)}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <h3 className="font-bold text-gray-900 text-base border-b pb-2">Mentions légales BTP</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Assureur décennale</Label>
              <Input value={decennaleCompany} onChange={(e) => setDecennaleCompany(e.target.value)} placeholder="ex: AXA, MMA, Groupama..." />
            </div>
            <div className="space-y-1.5">
              <Label>N° de police</Label>
              <Input value={decennalePolicy} onChange={(e) => setDecennalePolicy(e.target.value)} placeholder="ex: 123456789" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes / conditions</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Conditions de paiement, délais, réserves..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-amber-600 hover:bg-amber-700 text-white h-12 text-base font-bold shadow-md gap-2 rounded-xl"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
          Générer {docType === 'devis' ? 'le devis' : 'la facture et enregistrer la recette'}
        </Button>
      </form>
    </div>
  )
}
