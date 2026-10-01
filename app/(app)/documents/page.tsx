'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Upload, Search, FileText, Filter, Trash2, Building2, Eye, Receipt } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────
type DocumentStatus = 'uploaded' | 'analyzing' | 'analyzed' | 'validated' | 'error'
type DocumentType = 'supplier_invoice' | 'customer_invoice' | 'receipt' | 'quote' | 'other'

interface DocumentItem {
  id: string
  file_name: string
  file_type: string | null
  status: DocumentStatus
  document_type: DocumentType | null
  extracted_data: {
    third_party_name?: string | null
    amount_ht?: number | null
    amount_vat?: number | null
    amount_ttc?: number | null
    transaction_date?: string | null
    invoice_number?: string | null
  } | null
  chantiers?: { id: string; name: string } | null
  confidence_score: number | null
  created_at: string
}

// ─── Config UI ──────────────────────────────────────────────────────
const statusConfig: Record<DocumentStatus, { label: string; className: string }> = {
  uploaded: { label: 'Uploadé', className: 'bg-gray-100 text-gray-700 border-gray-200' },
  analyzing: { label: 'Analyse IA...', className: 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse' },
  analyzed: { label: 'À vérifier', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  validated: { label: 'Validé', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  error: { label: 'Erreur IA', className: 'bg-red-50 text-red-700 border-red-200' },
}

const typeConfig: Record<DocumentType, { label: string; icon: React.ReactNode; color: string }> = {
  supplier_invoice: { label: 'Facture Achat', icon: <FileText className="h-5 w-5" />, color: 'bg-orange-100 text-orange-600' },
  customer_invoice: { label: 'Facture Vente', icon: <FileText className="h-5 w-5" />, color: 'bg-emerald-100 text-emerald-600' },
  receipt: { label: 'Ticket', icon: <Receipt className="h-5 w-5" />, color: 'bg-amber-100 text-amber-600' },
  quote: { label: 'Devis', icon: <FileText className="h-5 w-5" />, color: 'bg-blue-100 text-blue-600' },
  other: { label: 'Autre', icon: <FileText className="h-5 w-5" />, color: 'bg-gray-100 text-gray-600' },
}

// ─── Helpers ────────────────────────────────────────────────────────
function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '0,00 €'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)
}

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(dateString))
}

// ─── Page Principale ────────────────────────────────────────────────
export default function DocumentsPage() {
  const { user } = useAuth()
  const supabase = createClient()

  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  // Séparation stricte de la logique de fetch
  const fetchDocuments = useCallback(async () => {
    if (!user) return
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
        setDocuments([])
        return
      }

      const { data, error: docsError } = await supabase
        .from('documents')
        .select(`
          *,
          chantiers (id, name)
        `)
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false })

      if (docsError) throw docsError
      setDocuments((data as DocumentItem[]) || [])
    } catch (err: unknown) {
      console.error('Erreur chargement documents:', err)
      setError(err instanceof Error ? err.message : 'Impossible de charger les documents')
    } finally {
      setLoading(false)
    }
  }, [user, supabase])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  // Logique de suppression sortie de la boucle de rendu et sécurisée
  const handleDeleteDocument = async (e: React.MouseEvent, id: string, name: string) => {
    e.preventDefault() // Empêche le clic de déclencher le <Link> parent
    e.stopPropagation()

    const ok = window.confirm(`Supprimer définitivement ce document et toutes les transactions comptables associées ?\n\nFichier : ${name}`)
    if (!ok) return

    setDeletingId(id)
    try {
      // 1. Supprimer les transactions liées (vérifiez si vous avez "ON DELETE CASCADE" en base, sinon c'est obligatoire)
      await supabase.from('transactions').delete().eq('document_id', id)
      // 2. Supprimer le document
      const { error } = await supabase.from('documents').delete().eq('id', id)
      
      if (error) throw error
      
      // 3. Mise à jour optimiste du state (pas de window.reload ignoble)
      setDocuments(prev => prev.filter(doc => doc.id !== id))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erreur lors de la suppression du document')
    } finally {
      setDeletingId(null)
    }
  }

  // Filtrage optimisé
  const filteredDocuments = documents.filter((doc) => {
    const q = search.toLowerCase()
    const matchesSearch =
      !q ||
      doc.file_name.toLowerCase().includes(q) ||
      (doc.extracted_data?.third_party_name || '').toLowerCase().includes(q) ||
      (doc.extracted_data?.invoice_number || '').toLowerCase().includes(q) ||
      (doc.chantiers?.name || '').toLowerCase().includes(q)

    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter
    const matchesType = typeFilter === 'all' || doc.document_type === typeFilter

    return matchesSearch && matchesStatus && matchesType
  })

  // KPIs
  const totalDocs = documents.length
  const validatedDocs = documents.filter((d) => d.status === 'validated').length
  const pendingDocs = documents.filter((d) => ['uploaded', 'analyzing', 'analyzed'].includes(d.status)).length

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents & Justificatifs</h1>
          <p className="text-sm text-gray-500">Centralisez vos factures et tickets. L'IA extrait la comptabilité.</p>
        </div>
        <Link href="/documents/upload">
          <Button className="bg-amber-600 hover:bg-amber-700 text-white gap-2 shadow-sm">
            <Upload className="h-4 w-4" />
            Nouveau document
          </Button>
        </Link>
      </div>

      {/* Stats rapides */}
      {!loading && totalDocs > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border p-4 shadow-sm">
            <p className="text-sm text-gray-500 font-medium">Total Documents</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{totalDocs}</p>
          </div>
          <div className="bg-white rounded-xl border p-4 shadow-sm">
            <p className="text-sm text-gray-500 font-medium">À vérifier / En cours</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{pendingDocs}</p>
          </div>
          <div className="bg-white rounded-xl border p-4 shadow-sm">
            <p className="text-sm text-gray-500 font-medium">Traités & Validés</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{validatedDocs}</p>
          </div>
        </div>
      )}

      {/* Barre de filtres */}
      <div className="bg-white rounded-xl border p-4 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Chercher un fournisseur, n° de pièce, chantier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="h-4 w-4 mr-2 text-gray-400" />
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="uploaded">Uploadé</SelectItem>
            <SelectItem value="analyzing">Analyse IA...</SelectItem>
            <SelectItem value="analyzed">À vérifier</SelectItem>
            <SelectItem value="validated">Validé</SelectItem>
            <SelectItem value="error">Erreur</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            <SelectItem value="supplier_invoice">Facture Achat</SelectItem>
            <SelectItem value="customer_invoice">Facture Vente</SelectItem>
            <SelectItem value="receipt">Ticket</SelectItem>
            <SelectItem value="quote">Devis</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Contenu principal */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-amber-600 mb-4" />
            <span className="text-gray-500">Chargement de vos documents...</span>
          </div>
        ) : error ? (
          <div className="p-12 text-center space-y-4">
            <div className="bg-red-50 text-red-700 p-4 rounded-lg inline-block">{error}</div>
            <Button variant="outline" onClick={fetchDocuments}>Réessayer</Button>
          </div>
        ) : totalDocs === 0 ? (
          <div className="p-16 text-center space-y-4">
            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto">
              <Upload className="h-8 w-8 text-amber-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Aucun document importé</h3>
            <p className="text-gray-500 max-w-md mx-auto">Prenez en photo vos tickets de caisse ou importez vos factures PDF. Notre IA se charge d'en extraire les données comptables.</p>
            <Link href="/documents/upload">
              <Button className="bg-amber-600 hover:bg-amber-700 text-white mt-4">Importer mon premier document</Button>
            </Link>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            Aucun document ne correspond à vos critères de recherche.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Fichier & Fournisseur</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Chantier</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">HT / TVA</th>
                  <th className="px-4 py-3 text-right">TTC</th>
                  <th className="px-4 py-3 text-center">Statut</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredDocuments.map((doc) => {
                  const type = doc.document_type ? typeConfig[doc.document_type] : typeConfig.other
                  const status = statusConfig[doc.status]
                  
                  // Calculs intelligents des montants
                  const ttc = doc.extracted_data?.amount_ttc || 0
                  const ht = doc.extracted_data?.amount_ht ?? (ttc ? ttc / 1.2 : 0)
                  const vat = doc.extracted_data?.amount_vat ?? (ttc ? ttc - ht : 0)

                  return (
                    <tr key={doc.id} className="hover:bg-gray-50/80 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${type.color}`}>
                            {type.icon}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 truncate">
                              {doc.extracted_data?.third_party_name || doc.file_name}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {doc.extracted_data?.invoice_number ? `N° ${doc.extracted_data.invoice_number}` : 'Sans numéro'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{type.label}</td>
                      <td className="px-4 py-3">
                        {doc.chantiers?.name ? (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <Building2 className="h-3 w-3" />
                            {doc.chantiers.name}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Non rattaché</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {doc.extracted_data?.transaction_date ? formatDate(doc.extracted_data.transaction_date) : formatDate(doc.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="text-gray-900 font-mono text-sm">{formatCurrency(ht)}</p>
                        <p className="text-gray-400 font-mono text-xs">+ {formatCurrency(vat)}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900 font-mono">
                        {formatCurrency(ttc)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <Link href={`/documents/${doc.id}`}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            disabled={deletingId === doc.id}
                            onClick={(e) => handleDeleteDocument(e, doc.id, doc.file_name)}
                          >
                            {deletingId === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
