'use client'

import { useAuth } from '@/hooks/use-auth'
import { StatsCard } from '@/components/dashboard/stats-card'
import { RecentDocuments } from '@/components/dashboard/recent-documents'
import Link from 'next/link'

// ─── Icônes pour les stats ───────────────────────────────────
function DocIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
  )
}

function RevenueIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" x2="12" y1="2" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  )
}

function ExpenseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  )
}

// ─── Page Dashboard ──────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth()

  // Extraire le prénom ou le nom d'utilisateur
  const displayName = user?.email?.split('@')[0] || 'Utilisateur'

  return (
    <div>
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
            Bonjour, {displayName} 👋
          </h1>
          <p className="text-gray-500 mt-1">
            Voici un résumé de votre activité
          </p>
        </div>

        <Link
          href="/documents/upload"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm sm:self-start"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" x2="12" y1="3" y2="15" />
          </svg>
          Nouveau document
        </Link>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
        <StatsCard
          title="Documents traités"
          value={0}
          icon={<DocIcon />}
          description="Ce mois-ci"
          trend={{ value: 0, direction: 'neutral' }}
        />
        <StatsCard
          title="Chiffre d'affaires"
          value="0 €"
          icon={<RevenueIcon />}
          description="Ce mois-ci"
          trend={{ value: 0, direction: 'neutral' }}
        />
        <StatsCard
          title="Dépenses"
          value="0 €"
          icon={<ExpenseIcon />}
          description="Ce mois-ci"
          trend={{ value: 0, direction: 'neutral' }}
        />
        <StatsCard
          title="Impayés"
          value="0 €"
          icon={<AlertIcon />}
          description="En attente"
        />
      </div>

      {/* Documents récents */}
      <RecentDocuments />
    </div>
  )
}