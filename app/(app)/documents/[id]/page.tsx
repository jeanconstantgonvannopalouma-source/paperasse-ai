'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ArrowLeft,
  Loader2,
  FileText,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Save,
  Trash2,
  HardHat,
  Percent,
  ShieldAlert,
  RefreshCw,
  Tag,
} from 'lucide-react'

type DocumentStatus = 'uploaded' | 'analyzing' | 'analyzed' | 'validated' | 'error'
type DocumentType = 'supplier_invoice' | 'customer_invoice' | 'receipt' | 'quote' | 'other'

interface VatRateDetail {
  rate: number
  base_ht: number
  vat_amount: number
}

interface ExtractedData {
  document_type?: DocumentType | null
  third_party_name?: string | null
  invoice_number?: string | null
  transaction_date?: string | null
  amount_ht?: number | null
  vat_amount?: number | null
  amount_ttc?: number | null
  category?: string | null
  payment_status?: 'paid' | 'unpaid' | 'unknown' | null
  confidence_score?: number | null
  vat_rates?: VatRateDetail[]
  is_autoliquidation?: boolean
}

interface DocumentDetail {
  id: string
  organization_id: string
  user_id: string | null
  file_url: string
  file_name: string
  file_type: string | null
  status: DocumentStatus
  document_type: DocumentType | null
  extracted_data: ExtractedData | null
  confidence_score: number | null
  chantier_id: string | null
  created_at: string
}

interface ChantierItem {
  id: string
  name: string
}

const CATEGORIES = [
  { value: 'Matières premières BTP', label: 'Matières premières & Matériaux (601)' },
  { value: 'Sous-traitance BTP', label: 'Sous-traitance & Prestations (604)' },
  { value: 'Outillage & Petit équipement', label: 'Outillage & Équipement (6063)' },
  { value: 'Carburant & Déplacements', label: 'Carburant & Déplacements (6251)' },
  { value: 'Frais de repas chantier', label: 'Frais de repas (6257)' },
  { value: 'Autre dépense', label: 'Autre charge générale' },
]

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '0,00 €'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(amount))
}

function toInputDateString(dateStr: string | null | undefined): string {
  if (!dateStr) return new Date().toISOString().slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.slice(0, 10)
  
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/')
    if (parts.length === 3) {
      const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2]
      return `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
    }
  }
  
  const d = new Date(dateStr)
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10)
  }
  
  return new Date().toISOString().slice(0, 10)
}

export default function DocumentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const supabase = createClient()

  const documentId = params?.id as string

  const [doc, setDoc] = useState<DocumentDetail | null>(null)
  const [chantiersList, setChantiersList] = useState<ChantierItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [thirdParty, setThirdParty] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [transactionDate, setTransactionDate] = useState('')
  const [amountHt, setAmountHt] = useState('')
  const [vatAmount, setVatAmount] = useState('')
  const [amountTtc, setAmountTtc] = useState('')
  const [documentType, setDocumentType] = useState<DocumentType>('supplier_invoice')
  const [category, setCategory] = useState('Matières premières BTP')
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid' | 'unknown'>('paid')
  const [selectedChantierId, setSelectedChantierId] = useState<string>('none')
  const [isAutoliquidation, setIsAutoliquidation] = useState(false)
  const [vatRates, setVatRates] = useState<VatRateDetail[]>([])

  const fetchDocument = useCallback(async () => {
    if (!user || !documentId) return
    setLoading(true)
    setError(null)

    try {
      const { data, error: docError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single()

      if (docError) throw docError
      setDoc(data)

      const ext = data.extracted_data || {}
      setThirdParty(ext.third_party_name || data.file_name || '')
      setInvoiceNumber(ext.invoice_number || '')
      setTransactionDate(toInputDateString(ext.transaction_date || data.created_at))

      const rawTtc = ext.amount_ttc ?? 0
      const rawHt = ext.amount_ht ?? (rawTtc ? rawTtc / 1.2 : 0)
      const rawVat = ext.vat_amount ?? (rawTtc ? rawTtc - rawHt : 0)

      setAmountHt(rawHt ? rawHt.toFixed(2) : '')
      setVatAmount(rawVat ? rawVat.toFixed(2) : '')
      setAmountTtc(rawTtc ? rawTtc.toFixed(2) : '')

      setDocumentType(data.document_type || ext.document_type || 'supplier_invoice')
      setCategory(ext.category || 'Matières premières BTP')
      setPaymentStatus(ext.payment_status || 'paid')
      setSelectedChantierId(data.chantier_id || 'none')
      setIsAutoliquidation(Boolean(ext.is_autoliquidation))
      setVatRates(Array.isArray(ext.vat_rates) ? ext.vat_rates : [])

      const { data: chData } = await supabase
        .from('chantiers')
        .select('id, name')
        .order('created_at', { ascending: false })

      if (chData) setChantiersList(chData)
    } catch (err: unknown) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Impossible de charger le document')
    } finally {
      setLoading(false)
    }
  }, [user, documentId, supabase])

  useEffect(() => {
    fetchDocument()
  }, [fetchDocument])

  const handleTtcChange = (val: string) => {
    setAmountTtc(val)
    const ttc = parseFloat(val.replace(',', '.'))
    if (!isNaN(ttc) && ttc > 0) {
      if (isAutoliquidation) {
        setAmountHt(ttc.toFixed(2))
        setVatAmount('0.00')
      } else {
        const ht = Math.round((ttc / 1.2) * 100) / 100
        const vat = Math.round((ttc - ht) * 100) / 100
        setAmountHt(ht.toFixed(2))
        setVatAmount(vat.toFixed(2))
      }
    }
  }

  const handleSave = async (validate = false) => {
    if (!doc) return
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const parsedHt = amountHt ? parseFloat(amountHt.replace(',', '.')) : 0
      const parsedVat = isAutoliquidation ? 0 : (vatAmount ? parseFloat(vatAmount.replace(',', '.')) : 0)
      const parsedTtc = isAutoliquidation ? parsedHt : (amountTtc ? parseFloat(amountTtc.replace(',', '.')) : parsedHt + parsedVat)

      const extracted_data: ExtractedData = {
        ...(doc.extracted_data || {}),
        document_type: documentType,
        third_party_name: thirdParty || null,
        invoice_number: invoiceNumber || null,
        transaction_date: transactionDate || null,
        amount_ht: parsedHt,
        vat_amount: parsedVat,
        amount_ttc: parsedTtc,
        category: category || 'Matières premières BTP',
        payment_status: paymentStatus,
        is_autoliquidation: isAutoliquidation,
        vat_rates: vatRates,
      }

      const res = await fetch('/api/documents/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: doc.id,
          validate,
          extracted_data,
          document_type: documentType,
          chantier_id: selectedChantierId === 'none' ? null : selectedChantierId,
          third_party_name: thirdParty || null,
          category: category || 'Matières premières BTP',
          invoice_number: invoiceNumber || null,
          transaction_date: transactionDate || null,
          amount_ht: parsedHt,
          vat_amount: parsedVat,
          amount_ttc: parsedTtc,
          payment_status: paymentStatus,
          confidence_score: doc.confidence_score,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la sauvegarde')

      setSuccess(validate ? 'Document validé et écriture comptable enregistrée avec succès !' : 'Modifications enregistrées')
      
      if (validate) {
        setTimeout(() => router.push('/documents'), 1200)
      } else {
        await fetchDocument()
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleReanalyze = async () => {
    if (!doc) return
    setAnalyzing(true)
    setError(null)
    setSuccess(null)

    try {
      await supabase.from('documents').update({ status: 'analyzing' }).eq('id', doc.id)

      const res = await fetch('/api/documents/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: doc.id }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Erreur lors du relancement de l\'analyse IA')
      }

      setSuccess('Analyse IA relancée avec succès !')
      await fetchDocument()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors du relancement IA')
      await supabase.from('documents').update({ status: 'uploaded' }).eq('id', doc.id)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleDelete = async () => {
    if (!doc || !window.confirm('Voulez-vous vraiment supprimer définitivement ce document ?')) return
    setDeleting(true)
    try {
      await supabase.from('transactions').delete().eq('document_id', doc.id)
      await supabase.from('documents').delete().eq('id', doc.id)
      router.push('/documents')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression')
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-16 text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600 mx-auto" />
        <p className="text-sm text-gray-500 font-medium">Chargement du document...</p>
      </div>
    )
  }

  const isDocValidated = doc?.status === 'validated'
  const isPdf = doc?.file_type?.includes('pdf') || doc?.file_name?.toLowerCase().endsWith('.pdf')
  
  // 🛡️ URL PROXY SÉCURISÉE (Plus jamais de 'Bucket not found')
  const proxyDownloadUrl = doc?.id ? `/api/documents/download?id=${doc.id}` : ''

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <Link href="/documents">
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Retour aux documents
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReanalyze}
            disabled={analyzing}
            className="gap-2 border-amber-300 text-amber-900 hover:bg-amber-50"
          >
            <RefreshCw className={`h-4 w-4 ${analyzing ? 'animate-spin' : ''}`} />
            Relancer l'IA
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="text-red-600 border-red-200 hover:bg-red-50 gap-2"
          >
            <Trash2 className="h-4 w-4" /> Supprimer
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2 font-medium">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Colonne Aperçu Fichier (Chargé via Proxy Côté Serveur) */}
        <div className="lg:col-span-5 bg-white p-4 rounded-2xl border border-gray-200 space-y-4 shadow-sm">
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
            <FileText className="h-4 w-4 text-amber-600" /> Aperçu de la pièce
          </h3>
          <div className="aspect-[3/4] bg-gray-50 rounded-xl border border-gray-200 overflow-hidden relative flex items-center justify-center">
            {proxyDownloadUrl ? (
              isPdf ? (
                <iframe src={proxyDownloadUrl} className="w-full h-full border-none" title="Aperçu PDF" />
              ) : (
                <img src={proxyDownloadUrl} alt={doc?.file_name} className="object-contain w-full h-full" />
              )
            ) : (
              <span className="text-gray-400 text-xs">Aperçu indisponible</span>
            )}
          </div>
          <a href={proxyDownloadUrl} target="_blank" rel="noopener noreferrer" className="block">
            <Button variant="outline" size="sm" className="w-full gap-2 text-xs font-medium">
              <ExternalLink className="h-3.5 w-3.5" /> Ouvrir le document original
            </Button>
          </a>
        </div>

        {/* Formulaire de Validation */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-gray-200 space-y-6 shadow-sm">
          <div className="flex items-center justify-between border-b pb-4">
            <h2 className="text-lg font-bold text-gray-900">Données comptables extraites</h2>
            <span className={isDocValidated ? 'px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200' : 'px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200'}>
              {isDocValidated ? 'Validé' : 'À vérifier / Valider'}
            </span>
          </div>

          <div className="space-y-4 text-sm">
            <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-100 space-y-2">
              <Label htmlFor="chantier" className="flex items-center gap-2 font-bold text-amber-900 text-xs uppercase tracking-wider">
                <HardHat className="h-4 w-4 text-amber-600" /> Chantier rattaché (Suivi de rentabilité)
              </Label>
              <Select value={selectedChantierId} onValueChange={setSelectedChantierId}>
                <SelectTrigger id="chantier" className="bg-white">
                  <SelectValue placeholder="Sélectionner un chantier..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun chantier particulier</SelectItem>
                  {chantiersList.map((ch) => (
                    <SelectItem key={ch.id} value={ch.id}>
                      {ch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="font-semibold text-xs text-gray-900">Autoliquidation de la TVA (Sous-traitance BTP)</p>
                  <p className="text-[11px] text-gray-500">Mention Art. 283-2 nonies du CGI (TVA à 0 €)</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={isAutoliquidation}
                onChange={(e) => {
                  const checked = e.target.checked
                  setIsAutoliquidation(checked)
                  if (checked) {
                    setVatAmount('0.00')
                  }
                }}
                className="h-4 w-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Type de document</Label>
                <Select value={documentType} onValueChange={(val: DocumentType) => setDocumentType(val)}>
                  <SelectTrigger className="bg-gray-50/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="supplier_invoice">Facture Fournisseur</SelectItem>
                    <SelectItem value="customer_invoice">Facture Client</SelectItem>
                    <SelectItem value="receipt">Ticket de caisse / Reçu</SelectItem>
                    <SelectItem value="quote">Devis</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Fournisseur / Tiers</Label>
                <Input value={thirdParty} onChange={(e) => setThirdParty(e.target.value)} placeholder="ex: LEROY MERLIN" className="bg-gray-50/50 font-medium" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>N° de pièce / Facture</Label>
                <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="ex: 849201-04" className="bg-gray-50/50 font-mono" />
              </div>

              <div className="space-y-1.5">
                <Label>Date de transaction</Label>
                <Input type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} className="bg-gray-50/50" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs text-gray-700 font-semibold">
                <Tag className="h-3.5 w-3.5 text-amber-600" /> Catégorie Plan Comptable BTP
              </Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-gray-50/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="space-y-1">
                <Label>Montant HT (€)</Label>
                <Input type="number" step="0.01" value={amountHt} onChange={(e) => setAmountHt(e.target.value)} className="font-mono" />
              </div>
              <div className="space-y-1">
                <Label>TVA (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={isAutoliquidation ? '0.00' : vatAmount}
                  disabled={isAutoliquidation}
                  onChange={(e) => setVatAmount(e.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label>Montant TTC (€)</Label>
                <Input type="number" step="0.01" value={amountTtc} onChange={(e) => handleTtcChange(e.target.value)} className="font-mono font-bold" />
              </div>
            </div>

            {vatRates.length > 0 && !isAutoliquidation && (
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2 text-xs">
                <p className="font-semibold text-gray-700 flex items-center gap-1">
                  <Percent className="h-3.5 w-3.5 text-amber-600" /> Décomposition TVA extraite :
                </p>
                <div className="grid grid-cols-3 gap-2 text-gray-600 font-medium border-t pt-2">
                  {vatRates.map((vr, idx) => (
                    <div key={idx} className="bg-white p-2 rounded border text-center">
                      <p className="font-bold text-gray-900">{vr.rate}%</p>
                      <p className="text-[10px] text-gray-500">Base HT: {formatCurrency(vr.base_ht)}</p>
                      <p className="text-[10px] text-amber-600 font-bold">TVA: {formatCurrency(vr.vat_amount)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => handleSave(false)} disabled={saving}>
                Enregistrer les modifications
              </Button>

              <Button type="button" onClick={() => handleSave(true)} disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-white gap-2 font-bold shadow-md">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Valider & Enregistrer l'écriture
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}