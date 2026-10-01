'use client'

import { useState } from 'react'
import Link from 'next/link'

// ─── Types ───────────────────────────────────────────────────
type DocumentStatus = 'traité' | 'en_attente' | 'erreur'
type DocumentType = 'facture_achat' | 'facture_vente' | 'devis' | 'avoir' | 'ticket' | 'autre'

interface DocumentItem {
  id: string
  name: string
  type: DocumentType
  date: string
  amount_ttc: number
  status: DocumentStatus
  supplier_or_client?: string
}

// ─── Données fictives (remplacées par Supabase plus tard) ────
const fakeDocuments: DocumentItem[] = [
  {
    id: '1',
    name: 'Facture Leroy Merlin',
    type: 'facture_achat',
    date: '2025-01-15',
    amount_ttc: 234.50,
    status: 'traité',
    supplier_or_client: 'Leroy Merlin',
  },
  {
    id: '2',
    name: 'Devis Client Dupont',
    type: 'devis',
    date: '2025-01-14',
    amount_ttc: 1850.00,
    status: 'en_attente',
    supplier_or_client: 'M. Dupont',
  },
  {
    id: '3',
    name: 'Ticket Brico Dépôt',
    type: 'ticket',
    date: '2025-01-13',
    amount_ttc: 45.90,
    status: 'traité',
    supplier_or_client: 'Brico Dépôt',
  },
  {
    id: '4',
    name: 'Facture Plomberie Martin',
    type: 'facture_vente',
    date: '2025-01-12',
    amount_ttc: 3200.00,
    status: 'traité',
    supplier_or_client: 'Mme Martin',
  },
  {
    id: '5',
    name: 'Avoir fournisseur Point P',
    type: 'avoir',
    date: '2025-01-11',
    amount_ttc: -120.00,
    status: 'erreur',
    supplier_or_client: 'Point P',
  },
]

// ─── Mappings UI ─────────────────────────────────────────────
const statusConfig: Record<DocumentStatus, { label: string; className: string }> = {
  'traité': {
    label: 'Traité',
    className: 'bg-green-50 text-green-700 border border-green-200',
  },
  'en_attente': {
    label: 'En attente',
    className: 'bg-amber-50 text-amber-700 border border-amber-200',
  },
  'erreur': {
    label: 'Erreur',
    className: 'bg-red-50 text-red-700 border border-red-200',
  },
}

const typeConfig: Record<DocumentType, { label: string; icon: string; color: string }> = {
  'facture_achat': { label: 'Achat', icon: '🧾', color: 'bg-orange-100' },
  'facture_vente': { label: 'Vente', icon: '💰', color: 'bg-green-100' },
  'devis': { label: 'Devis', icon: '📋', color: 'bg-blue-100' },
  'avoir': { label: 'Avoir', icon: '↩️', color: 'bg-purple-100' },
  'ticket': { label: 'Ticket', icon: '🎫', color: 'bg-yellow-100' },
  'autre': { label: 'Autre', icon: '📄', color: 'bg-gray-100' },
}

// ─── Formater un montant en euros ────────────────────────────
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

// ─── Formater une date ───────────────────────────────────────
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return "Aujourd'hui"
  if (diffDays === 1) return 'Hier'
  if (diffDays < 7) return `Il y a ${diffDays} jours`

  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

// ─── Skeleton Loader ─────────────────────────────────────────
function DocumentRowSkeleton() {return(
    <div className="flex items-center justify-between p-4 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-gray-200 rounded-lg" />
        <div>
          <div className="h-4 w-40 bg-gray-200 rounded mb-2" />
          <div className="h-3 w-24 bg-gray-100 rounded" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="h-4 w-20 bg-gray-200 rounded" />
        <div className="h-6 w-16 bg-gray-200 rounded-full" />
      </div>
    </div>
  )
}

// ─── Composant principal ─────────────────────────────────────
interface RecentDocumentsProps {
  documents?: DocumentItem[]
  loading?: boolean
  maxItems?: number
}

export function RecentDocuments({
  documents = fakeDocuments,
  loading = false,
  maxItems = 5,
}: RecentDocumentsProps) {
  const [filter, setFilter] = useState<DocumentStatus | 'all'>('all')

  const filteredDocuments =
    filter === 'all'
      ? documents.slice(0, maxItems)
      : documents.filter((doc) => doc.status === filter).slice(0, maxItems)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Documents récents
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Vos derniers documents traités par l&apos;IA
            </p>
          </div>

          {/* Filtres */}
          <div className="flex items-center gap-2">
            {(['all', 'traité', 'en_attente', 'erreur'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`
                  px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                  ${filter === f
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }
                `}
              >
                {f === 'all' ? 'Tous' : statusConfig[f].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Liste des documents */}
      {loading ? (
        <div className="divide-y divide-gray-50">
          {Array.from({ length: 3 }).map((_, i) => (
            <DocumentRowSkeleton key={i} />
          ))}
        </div>
      ) : filteredDocuments.length > 0 ? (
        <div className="divide-y divide-gray-50">
          {filteredDocuments.map((doc) => {
            const type = typeConfig[doc.type]
            const status = statusConfig[doc.status]

            return (
              <Link
                key={doc.id}
                href={`/documents/${doc.id}`}
                className="flex items-center justify-between p-4 hover:bg-gray-50/80 transition-colors group"
              >
                {/* Gauche : icône + infos */}
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`w-10 h-10 ${type.color} rounded-lg flex items-center justify-center text-lg flex-shrink-0`}>
                    {type.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                      {doc.name}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {type.label}
                      {doc.supplier_or_client && (
                        <span> · {doc.supplier_or_client}</span>
                      )}
                      <span className="hidden sm:inline"> · {formatDate(doc.date)}</span>
                    </p>
                  </div>
                </div>

                {/* Droite : montant + statut */}
                <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                  <p className={`font-semibold text-sm ${doc.amount_ttc < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {formatCurrency(doc.amount_ttc)}
                  </p>
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${status.className}`}>
                    {status.label}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        /* État vide */
        <div className="p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400">
              <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
              <path d="M14 2v4a2 2 0 0 0 2 2h4" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">
            Aucun document
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Commencez par uploader votre premier document
          </p>
          <Link
            href="/documents/upload"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" x2="12" y1="3" y2="15" />
            </svg>
            Uploader un document
          </Link>
        </div>
      )}

      {/* Footer avec lien "voir tout" */}
      {filteredDocuments.length > 0 && (
        <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100">
          <Link
            href="/documents"
            className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            Voir tous les documents →
          </Link>
        </div>
      )}
    </div>
  )
}