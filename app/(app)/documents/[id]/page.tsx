'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
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
  Loader2,
  FileText,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Save,
  Trash2,
  RefreshCw,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────
type DocumentStatus = 'uploaded' | 'analyzing' | 'analyzed' | 'validated' | 'error'
type DocumentType =
  | 'supplier_invoice'
  | 'customer_invoice'
  | 'receipt'
  | 'quote'
  | 'other'

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
  needs_review?: boolean | null
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
  created_at: string
}

// ─── Config ──────────────────────────────────────────────────
const statusConfig: Record<DocumentStatus, { label: string; className: string }> = {
  uploaded: { label: 'Uploadé', className: 'bg-gray-100 text-gray-700 border border-gray-200' },
  analyzing: { label: 'Analyse IA…', className: 'bg-blue-50 text-blue-700 border border-blue-200' },
  analyzed: { label: 'Analysé', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  validated: { label: 'Validé', className: 'bg-green-50 text-green-700 border border-green-200' },
  error: { label: 'Erreur', className: 'bg-red-50 text-red-700 border border-red-200' },
}

const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'supplier_invoice', label: 'Facture fournisseur (achat)' },
  { value: 'customer_invoice', label: 'Facture client (vente)' },
  { value: 'receipt', label: 'Ticket / Reçu' },
  { value: 'quote', label: 'Devis' },
  { value: 'other', label: 'Autre' },
]

const PAYMENT_STATUSES = [
  { value: 'paid', label: 'Payé' },
  { value: 'unpaid', label: 'Impayé' },
  { value: 'unknown', label: 'Inconnu' },
]

const CATEGORIES = [
  'Fournitures chantier',
  'Outillage',
  'Sous-traitance',
  'Carburant',
  'Location matériel',
  'Assurances',
  'Frais généraux',
  'Honoraires',
  'Autres charges',
  'Ventes / Prestations',
]

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(dateString))
}

function toInputDate(dateString: string | null | undefined): string {
  if (!dateString) return ''
  try {
    return new Date(dateString).toISOString().slice(0, 10)
  } catch {
    return ''
  }
}

// ─── Page ────────────────────────────────────────────────────
export default function DocumentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const supabase = createClient()

  const documentId = params?.id as string

  const [doc, setDoc] = useState<DocumentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Formulaire éditable (données extraites)
  const [thirdParty, setThirdParty] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [transactionDate, setTransactionDate] = useState('')
  const [amountHt, setAmountHt] = useState('')
  const [vatAmount, setVatAmount] = useState('')
  const [amountTtc, setAmountTtc] = useState('')
  const [documentType, setDocumentType] = useState<DocumentType | ''>('')
  const [category, setCategory] = useState('')
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid' | 'unknown'>('unknown')

  // ─── Charger le document ───────────────────────────────────
  const fetchDocument = useCallback(async () => {
    if (!user || !documentId) return

    setLoading(true)
    setError(null)

    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      if (profileError) throw profileError
      if (!profile?.organization_id) {
        throw new Error('Aucune entreprise associée à votre compte')
      }

      const { data, error: docError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .eq('organization_id', profile.organization_id)
        .single()

      if (docError) throw docError
      if (!data) throw new Error('Document introuvable')

      const document = data as DocumentDetail
      setDoc(document)

      // Préremplir le formulaire
      const extracted = document.extracted_data || {}
      setThirdParty(extracted.third_party_name || '')
      setInvoiceNumber(extracted.invoice_number || '')
      setTransactionDate(toInputDate(extracted.transaction_date))
      setAmountHt(extracted.amount_ht != null ? String(extracted.amount_ht) : '')
      setVatAmount(extracted.vat_amount != null ? String(extracted.vat_amount) : '')
      setAmountTtc(extracted.amount_ttc != null ? String(extracted.amount_ttc) : '')
      setDocumentType(
        (document.document_type || extracted.document_type || '') as DocumentType | ''
      )
      setCategory(extracted.category || '')
      setPaymentStatus(extracted.payment_status || 'unknown')
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

  // ─── Recalcul TTC si HT + TVA ──────────────────────────────
  function handleHtChange(value: string) {
    setAmountHt(value)
    const ht = parseFloat(value.replace(',', '.'))
    const tva = parseFloat(vatAmount.replace(',', '.'))
    if (!Number.isNaN(ht) && !Number.isNaN(tva)) {
      setAmountTtc((ht + tva).toFixed(2))
    }
  }

  function handleVatChange(value: string) {
    setVatAmount(value)
    const ht = parseFloat(amountHt.replace(',', '.'))
    const tva = parseFloat(value.replace(',', '.'))
    if (!Number.isNaN(ht) && !Number.isNaN(tva)) {
      setAmountTtc((ht + tva).toFixed(2))
    }
  }

  // ─── Sauvegarder / Valider ─────────────────────────────────
  async function handleSave(validate = false) {
    if (!doc) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const parsedHt = amountHt ? parseFloat(amountHt.replace(',', '.')) : null
      const parsedVat = vatAmount ? parseFloat(vatAmount.replace(',', '.')) : null
      const parsedTtc = amountTtc ? parseFloat(amountTtc.replace(',', '.')) : null

      const extracted_data: ExtractedData = {
        ...(doc.extracted_data || {}),
        document_type: (documentType || null) as DocumentType | null,
        third_party_name: thirdParty || null,
        invoice_number: invoiceNumber || null,
        transaction_date: transactionDate || null,
        amount_ht: Number.isNaN(parsedHt as number) ? null : parsedHt,
        vat_amount: Number.isNaN(parsedVat as number) ? null : parsedVat,
        amount_ttc: Number.isNaN(parsedTtc as number) ? null : parsedTtc,
        category: category || null,
        payment_status: paymentStatus,
        needs_review: !validate,
      }

      const newStatus: DocumentStatus = validate ? 'validated' : doc.status === 'uploaded' ? 'analyzed' : doc.status

      const { error: updateError } = await supabase
        .from('documents')
        .update({
          extracted_data,
          document_type: documentType || null,
          status: newStatus,
          confidence_score: doc.confidence_score,
        })
        .eq('id', doc.id)

      if (updateError) throw updateError

      // Si validé, créer/mettre à jour une transaction liée
      if (validate && parsedTtc != null) {
        const transactionType =
          documentType === 'customer_invoice' || documentType === 'quote'
            ? 'income'
            : documentType === 'receipt'
              ? 'receipt'
              : 'expense'

        // Vérifier si une transaction existe déjà pour ce document
        const { data: existing } = await supabase
          .from('transactions')
          .select('id')
          .eq('document_id', doc.id)
          .maybeSingle()

        const payload = {
          organization_id: doc.organization_id,
          document_id: doc.id,
          transaction_type: transactionType,
          third_party_name: thirdParty || null,
          category: category || null,
          invoice_number: invoiceNumber || null,
          transaction_date: transactionDate || null,
          amount_ht: parsedHt ?? 0,
          vat_amount: parsedVat ?? 0,
          amount_ttc: parsedTtc,
          payment_status: paymentStatus,
          validation_status: 'validated',
        }

        if (existing?.id) {
          await supabase.from('transactions').update(payload).eq('id', existing.id)
        } else {
          await supabase.from('transactions').insert(payload)
        }
      }

      setSuccess(validate ? 'Document validé et transaction créée' : 'Modifications enregistrées')
      await fetchDocument()
    } catch (err: unknown) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  // ─── Relancer l'analyse IA ─────────────────────────────────
  async function handleReanalyze() {
    if (!doc) return
    setAnalyzing(true)
    setError(null)
    setSuccess(null)

    try {
      await supabase
        .from('documents')
        .update({ status: 'analyzing' })
        .eq('id', doc.id)

      const res = await fetch('/api/documents/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: doc.id }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Analyse IA indisponible pour le moment')
      }

      setSuccess('Analyse relancée')
      await fetchDocument()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur analyse IA')
      // Remettre un statut lisible
      await supabase.from('documents').update({ status: 'uploaded' }).eq('id', doc.id)
      await fetchDocument()
    } finally {
      setAnalyzing(false)
    }
  }

  // ─── Supprimer ─────────────────────────────────────────────
  async function handleDelete() {
    if (!doc) return
    const ok = window.confirm('Supprimer définitivement ce document ?')
    if (!ok) return

    setDeleting(true)
    setError(null)

    try {
      // Supprimer d'abord les transactions liées (si existantes)
      await supabase.from('transactions').delete().eq('document_id', doc.id)

      const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .eq('id', doc.id)

      if (deleteError) throw deleteError

      router.push('/documents')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Suppression impossible')
      setDeleting(false)
    }
  }

  // ─── États de chargement / erreur ──────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-500">Chargement du document…</span>
      </div>
    )
  }

  if (error && !doc) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Document introuvable</h2>
        <p className="text-gray-500 mb-6">{error}</p>
        <Link href="/documents">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Retour aux documents
          </Button>
        </Link>
      </div>
    )
  }

  if (!doc) return null

  const status = statusConfig[doc.status]
  const isImage = doc.file_type?.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(doc.file_name)

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/documents"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux documents
        </Link>

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 truncate">
                {thirdParty || doc.file_name}
              </h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${status.className}`}>
                {status.label}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {doc.file_name} · Ajouté le {formatDate(doc.created_at)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleReanalyze}
              disabled={analyzing || saving}
            >
              {analyzing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Relancer l&apos;IA
            </Button>

            {doc.file_url && (
              <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Ouvrir le fichier
                </Button>
              </a>
            )}

            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Supprimer
            </Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 bg-red-50 text-red-600 text-sm p-4 rounded-lg flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 bg-green-50 text-green-700 text-sm p-4 rounded-lg flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Aperçu fichier */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden sticky top-24">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Aperçu</span>
            </div>
            <div className="p-4 bg-gray-50 min-h-[320px] flex items-center justify-center">
              {isImage && doc.file_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={doc.file_url}
                  alt={doc.file_name}
                  className="max-w-full max-h-[480px] rounded-lg shadow object-contain"
                />
              ) : doc.file_url ? (
                <div className="text-center p-6">
                  <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-sm text-gray-600 mb-4 break-all">{doc.file_name}</p>
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="gap-2">
                      <ExternalLink className="h-4 w-4" />
                      Voir le PDF / fichier
                    </Button>
                  </a>
                </div>
              ) : (
                <p className="text-sm text-gray-400">Aperçu indisponible</p>
              )}
            </div>
          </div>
        </div>

        {/* Formulaire données extraites */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                Données extraites
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Vérifiez et corrigez les informations avant de valider
              </p>
            </div>

            <div className="p-6 space-y-5">
              {/* Type + paiement */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type de document</Label>
                  <Select
                    value={documentType}
                    onValueChange={(v) => setDocumentType(v as DocumentType)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner…" />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Statut de paiement</Label>
                  <Select
                    value={paymentStatus}
                    onValueChange={(v) =>
                      setPaymentStatus(v as 'paid' | 'unpaid' | 'unknown')
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_STATUSES.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Tiers + n° facture */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="thirdParty">Fournisseur / Client</Label>
                  <Input
                    id="thirdParty"
                    value={thirdParty}
                    onChange={(e) => setThirdParty(e.target.value)}
                    placeholder="ex: Leroy Merlin"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoiceNumber">N° de facture</Label>
                  <Input
                    id="invoiceNumber"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="ex: FA-2025-001"
                  />
                </div>
              </div>

              {/* Date + catégorie */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date de la transaction</Label>
                  <Input
                    id="date"
                    type="date"
                    value={transactionDate}
                    onChange={(e) => setTransactionDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Catégorie comptable</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner…" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Montants */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ht">Montant HT (€)</Label>
                  <Input
                    id="ht"
                    inputMode="decimal"
                    value={amountHt}
                    onChange={(e) => handleHtChange(e.target.value)}
                    placeholder="0,00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tva">TVA (€)</Label>
                  <Input
                    id="tva"
                    inputMode="decimal"
                    value={vatAmount}
                    onChange={(e) => handleVatChange(e.target.value)}
                    placeholder="0,00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ttc">Montant TTC (€)</Label>
                  <Input
                    id="ttc"
                    inputMode="decimal"
                    value={amountTtc}
                    onChange={(e) => setAmountTtc(e.target.value)}
                    placeholder="0,00"
                    className="font-semibold"
                  />
                </div>
              </div>

              {/* Récap montants */}
              <div className="bg-gray-50 rounded-lg p-4 flex flex-wrap gap-6 text-sm">
                <div>
                  <p className="text-gray-500">HT</p>
                  <p className="font-semibold text-gray-900">
                    {formatCurrency(parseFloat(amountHt.replace(',', '.')) || null)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">TVA</p>
                  <p className="font-semibold text-gray-900">
                    {formatCurrency(parseFloat(vatAmount.replace(',', '.')) || null)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">TTC</p>
                  <p className="font-semibold text-blue-600 text-lg">
                    {formatCurrency(parseFloat(amountTtc.replace(',', '.')) || null)}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row gap-3 sm:justify-end bg-gray-50/50">
              <Button
                variant="outline"
                onClick={() => handleSave(false)}
                disabled={saving || analyzing}
                className="gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Enregistrer
              </Button>
              <Button
                onClick={() => handleSave(true)}
                disabled={saving || analyzing}
                className="gap-2"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Valider & créer la transaction
              </Button>
            </div>
          </div>

          <p className="text-xs text-gray-400 mt-3 px-1">
            Astuce : “Valider” enregistre les données et crée (ou met à jour) une ligne dans
            Transactions pour l’export comptable.
          </p>
        </div>
      </div>
    </div>
  )
}