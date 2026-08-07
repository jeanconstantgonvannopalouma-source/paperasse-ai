'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Upload, Search, FileText, Filter } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────
type DocumentStatus = 'uploaded' | 'analyzing' | 'analyzed' | 'validated' | 'error'
type DocumentType =
  | 'supplier_invoice'
  | 'customer_invoice'
  | 'receipt'
  | 'quote'
  | 'other'

interface DocumentItem {
  id: string
  file_name: string
  file_type: string | null
  status: DocumentStatus
  document_type: DocumentType | null
  extracted_data: {
    third_party_name?: string | null
    amount_ttc?: number | null
    transaction_date?: string | null
    invoice_number?: string | null
  } | null
  confidence_score: number | null
  created_at: string
}

// ─── Config UI ───────────────────────────────────────────────
const statusConfig: Record<
  DocumentStatus,
  { label: string; className: string }
> = {
  uploaded: {
    label: 'Uploadé',
    className: 'bg-gray-100 text-gray-700 border border-gray-200',
  },
  analyzing: {
    label: 'Analyse IA…',
    className: 'bg-blue-50 text-blue-700 border border-blue-200',
  },
  analyzed: {
    label: 'Analysé',
    className: 'bg-amber-50 text-amber-700 border border-amber-200',
  },
  validated: {
    label: 'Validé',
    className: 'bg-green-50 text-green-700 border border-green-200',
  },
  error: {
    label: 'Erreur',
    className: 'bg-red-50 text-red-700 border border-red-200',
  },
}

const typeConfig: Record<
  DocumentType,
  { label: string; icon: string; color: string }
> = {
  supplier_invoice: { label: 'Facture achat', icon: '🧾', color: 'bg-orange-100' },
  customer_invoice: { label: 'Facture vente', icon: '💰', color: 'bg-green-100' },
  receipt: { label: 'Ticket', icon: '🎫', color: 'bg-yellow-100' },
  quote: { label: 'Devis', icon: '📋', color: 'bg-blue-100' },
  other: { label: 'Autre', icon: '📄', color: 'bg-gray-100' },
}

// ─── Helpers ─────────────────────────────────────────────────
function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateString))
}

// ─── Composant Stats ─────────────────────────────────────────
function StatsBar({ documents }: { documents: DocumentItem[] }) {
  const total = documents.length
  const validated = documents.filter((d) => d.status === 'validated').length
  const pending = documents.filter((d) =>
    ['uploaded', 'analyzing', 'analyzed'].includes(d.status)
  ).length
  const errors = documents.filter((d) => d.status === 'error').length

  const stats = [
    { label: 'Total', value: total, color: 'text-gray-900' },
    { label: 'Validés', value: validated, color: 'text-green-600' },
    { label: 'En cours', value: pending, color: 'text-amber-600' },
    { label: 'Erreurs', value: errors, color: 'text-red-600' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm"
        >
          <p className="text-sm text-gray-500">{stat.label}</p>
          <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Page principale ─────────────────────────────────────────
export default function DocumentsPage() {
  const { user } = useAuth()
  const supabase = createClient()

  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  // ─── Charger les documents ─────────────────────────────────
  const fetchDocuments = useCallback(async () => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      // Récupérer le profil pour avoir organization_id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      if (profileError) throw profileError

      if (!profile?.organization_id) {
        setDocuments([])
        setLoading(false)
        return
      }

      // Récupérer les documents de l'organisation
      const { data, error: docsError } = await supabase
        .from('documents')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false })

      if (docsError) throw docsError

      setDocuments((data as DocumentItem[]) || [])
    } catch (err: unknown) {
      console.error('Erreur chargement documents:', err)
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de charger les documents'
      )
    } finally {
      setLoading(false)
    }
  }, [user, supabase])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  // ─── Filtrage côté client ──────────────────────────────────
  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      search === '' ||
      doc.file_name.toLowerCase().includes(search.toLowerCase()) ||
      doc.extracted_data?.third_party_name
        ?.toLowerCase()
        .includes(search.toLowerCase()) ||
      doc.extracted_data?.invoice_number
        ?.toLowerCase()
        .includes(search.toLowerCase())

    const matchesStatus =
      statusFilter === 'all' || doc.status === statusFilter

    const matchesType =
      typeFilter === 'all' || doc.document_type === typeFilter

    return matchesSearch && matchesStatus && matchesType
  })

  // ─── Rendu ─────────────────────────────────────────────────
  return (
    <div>
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
            Documents
          </h1>
          <p className="text-gray-500 mt-1">
            Gérez vos factures, tickets et devis
          </p>
        </div>

        <Link href="/documents/upload">
          <Button className="gap-2 shadow-sm">
            <Upload className="h-4 w-4" />
            Uploader un document
          </Button>
        </Link>
      </div>

      {/* Stats */}
      {!loading && documents.length > 0 && <StatsBar documents={documents} />}

      {/* Barre de filtres */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Recherche */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Rechercher un document, fournisseur, n° facture…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filtre statut */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="h-4 w-4 mr-2 text-gray-400" />
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="uploaded">Uploadé</SelectItem>
              <SelectItem value="analyzing">Analyse IA…</SelectItem>
              <SelectItem value="analyzed">Analysé</SelectItem>
              <SelectItem value="validated">Validé</SelectItem>
              <SelectItem value="error">Erreur</SelectItem>
            </SelectContent>
          </Select>

          {/* Filtre type */}
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              <SelectItem value="supplier_invoice">Facture achat</SelectItem>
              <SelectItem value="customer_invoice">Facture vente</SelectItem>
              <SelectItem value="receipt">Ticket</SelectItem>
              <SelectItem value="quote">Devis</SelectItem>
              <SelectItem value="other">Autre</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-3 text-gray-500">Chargement des documents…</span>
          </div>
        )}

        {/* Erreur */}
        {!loading && error && (
          <div className="p-8 text-center">
            <div className="bg-red-50 text-red-600 text-sm p-4 rounded-lg inline-block">
              {error}
            </div>
            <div className="mt-4">
              <Button variant="outline" onClick={fetchDocuments}>
                Réessayer
              </Button>
            </div>
          </div>
        )}

        {/* État vide */}
        {!loading && !error && documents.length === 0 && (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Aucun document pour le moment
            </h3>
            <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
              Uploadez votre première facture ou ticket. L&apos;IA extraira
              automatiquement les informations comptables.
            </p>
            <Link href="/documents/upload">
              <Button className="gap-2">
                <Upload className="h-4 w-4" />
                Uploader mon premier document
              </Button>
            </Link>
          </div>
        )}

        {/* Aucun résultat après filtre */}
        {!loading &&
          !error &&
          documents.length > 0 &&
          filteredDocuments.length === 0 && (
            <div className="p-12 text-center">
              <p className="text-gray-500">
                Aucun document ne correspond à vos filtres.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setSearch('')
                  setStatusFilter('all')
                  setTypeFilter('all')
                }}
              >
                Réinitialiser les filtres
              </Button>
            </div>
          )}

        {/* Liste des documents */}
        {!loading && !error && filteredDocuments.length > 0 && (
          <>
            {/* Header tableau (desktop) */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div className="col-span-4">Document</div>
              <div className="col-span-2">Type</div>
              <div className="col-span-2">Montant TTC</div>
              <div className="col-span-2">Date</div>
              <div className="col-span-2">Statut</div>
            </div>

            <div className="divide-y divide-gray-50">
              {filteredDocuments.map((doc) => {
                const type = doc.document_type
                  ? typeConfig[doc.document_type]
                  : typeConfig.other
                const status = statusConfig[doc.status]

                return (
                  <Link
                    key={doc.id}
                    href={`/documents/${doc.id}`}
                    className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-6 py-4 hover:bg-gray-50/80 transition-colors group items-center"
                  >
                    {/* Document */}
                    <div className="md:col-span-4 flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 ${type.color} rounded-lg flex items-center justify-center text-lg flex-shrink-0`}
                      >
                        {type.icon}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                          {doc.extracted_data?.third_party_name || doc.file_name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {doc.extracted_data?.invoice_number
                            ? `N° ${doc.extracted_data.invoice_number}`
                            : doc.file_name}
                        </p>
                      </div>
                    </div>

                    {/* Type */}
                    <div className="md:col-span-2">
                      <span className="text-sm text-gray-600">{type.label}</span>
                    </div>

                    {/* Montant */}
                    <div className="md:col-span-2">
                      <span className="text-sm font-semibold text-gray-900">
                        {formatCurrency(doc.extracted_data?.amount_ttc)}
                      </span>
                    </div>

                    {/* Date */}
                    <div className="md:col-span-2">
                      <span className="text-sm text-gray-500">
                        {doc.extracted_data?.transaction_date
                          ? formatDate(doc.extracted_data.transaction_date)
                          : formatDate(doc.created_at)}
                      </span>
                    </div>

                    {/* Statut */}
                    <div className="md:col-span-2">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-medium ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-gray-50/50 border-t border-gray-100 text-sm text-gray-500">
              {filteredDocuments.length} document
              {filteredDocuments.length > 1 ? 's' : ''}
              {filteredDocuments.length !== documents.length &&
                ` sur ${documents.length}`}
            </div>
          </>
        )}
      </div>
    </div>
  )
}