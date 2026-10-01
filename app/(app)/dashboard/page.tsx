'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import {
  TrendingUp, TrendingDown, Receipt, AlertTriangle, CheckCircle2,
  Clock, ArrowUpRight, ArrowDownRight, RefreshCw, Plus, Download,
  Euro, Building2, PieChart
} from 'lucide-react'
import { InstallPwaButton } from '@/components/install-pwa-button'
import { PwaBanner } from '@/components/pwa-banner'

interface TxItem {
  id: string
  transaction_type: 'expense' | 'income' | 'receipt' | 'other'
  third_party_name: string | null
  amount_ht: number | null
  vat_amount: number | null
  amount_ttc: number | null
  transaction_date: string | null
  created_at: string
}

interface DocItem {
  id: string
  file_name: string
  status: string
  extracted_data: { third_party_name?: string | null; amount_ttc?: number | null } | null
  created_at: string
}

interface ChantierItem {
  id: string
  name: string
  budget_ht: number | null
  client_name: string | null
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '0,00 €'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(amount))
}

function formatDate(dateString: string | null): string {
  if (!dateString) return 'Date inconnue'
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(dateString))
}

export default function DashboardPage() {
  const { user } = useAuth()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [transactions, setTransactions] = useState<TxItem[]>([])
  const [pendingDocs, setPendingDocs] = useState<DocItem[]>([])
  const [chantiers, setChantiers] = useState<ChantierItem[]>([])
  const [missingBankCount, setMissingBankCount] = useState(0)

  const loadDashboardData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // 1. Charger les transactions depuis l'API Serveur (Même source que la page /transactions)
      const res = await fetch('/api/transactions')
      const data = await res.json()
      
      const loadedTxs: TxItem[] = data.transactions || []
      setTransactions(loadedTxs)

      // 2. Charger les documents en attente
      const { data: docData } = await supabase
        .from('documents')
        .select('*')
        .neq('status', 'validated')
        .order('created_at', { ascending: false })
        .limit(5)
      setPendingDocs((docData as DocItem[]) || [])

      // 3. Charger les chantiers
      const { data: chantierData } = await supabase
        .from('chantiers')
        .select('id, name, budget_ht, client_name')
        .limit(5)
      setChantiers((chantierData as ChantierItem[]) || [])

      // 4. Lignes bancaires orphelines
      const { count: bankCount } = await supabase
        .from('bank_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'unmatched')
        .lt('amount', 0)
      setMissingBankCount(bankCount || 0)

    } catch (err: unknown) {
      console.error('Erreur chargement dashboard:', err)
      setError("Erreur lors du chargement des données financières.")
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  // --- CALCULS FINANCIERS BASÉS SUR LES TRANSACTIONS RÉELLES ---
  const incomes = transactions.filter((t) => t.transaction_type === 'income')
  const expenses = transactions.filter((t) => ['expense', 'receipt'].includes(t.transaction_type))

  const totalIncomeTtc = incomes.reduce((sum, t) => sum + Math.abs(Number(t.amount_ttc || 0)), 0)
  const totalIncomeHt = incomes.reduce((sum, t) => {
    const ht = Math.abs(Number(t.amount_ht || 0))
    const ttc = Math.abs(Number(t.amount_ttc || 0))
    return ht > 0 ? ht : (ttc > 0 ? ttc / 1.2 : 0)
  }, 0)

  const totalExpenseTtc = expenses.reduce((sum, t) => sum + Math.abs(Number(t.amount_ttc || 0)), 0)
  const totalExpenseHt = expenses.reduce((sum, t) => {
    const ht = Math.abs(Number(t.amount_ht || 0))
    const ttc = Math.abs(Number(t.amount_ttc || 0))
    return ht > 0 ? ht : (ttc > 0 ? ttc / 1.2 : 0)
  }, 0)

  const vatCollected = incomes.reduce((sum, t) => sum + Math.abs(Number(t.vat_amount || 0)), 0)
  const vatDeductible = expenses.reduce((sum, t) => sum + Math.abs(Number(t.vat_amount || 0)), 0)

  const vatNetToPay = vatCollected - vatDeductible
  const soldeMarge = totalIncomeHt - totalExpenseHt
  
  const margePercent = totalIncomeHt > 0 ? (soldeMarge / totalIncomeHt) * 100 : 0
  const isMargeSaine = margePercent >= 15

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">Tableau de bord</h1>
          <p className="text-sm text-gray-500 mt-1">Pilotage en temps réel de votre activité BTP</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={loadDashboardData} disabled={loading} className="gap-2 text-gray-500 hover:text-gray-900">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-amber-600' : ''}`} /> Actualiser
          </Button>
          <InstallPwaButton />
          <Link href="/documents/upload">
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white gap-2 shadow-sm font-medium">
              <Plus className="h-4 w-4" /> Nouveau document
            </Button>
          </Link>
          <Link href="/exports">
            <Button variant="outline" size="sm" className="gap-2 border-gray-300 shadow-sm font-medium text-gray-700">
              <Download className="h-4 w-4" /> Exports
            </Button>
          </Link>
        </div>
      </div>

      <PwaBanner />

      {error && (
        <div className="p-4 rounded-xl bg-red-50/80 border border-red-200 text-red-700 text-sm flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {(pendingDocs.length > 0 || missingBankCount > 0) && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-0.5 shadow-md">
          <div className="bg-white/95 backdrop-blur-sm rounded-[14px] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-100 text-amber-600 rounded-xl">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Comptabilité en attente</h3>
                <p className="text-xs text-gray-600 mt-0.5 font-medium">
                  {pendingDocs.length > 0 && <span className="text-amber-600">{pendingDocs.length} pièce(s) à valider</span>}
                  {pendingDocs.length > 0 && missingBankCount > 0 && ' • '}
                  {missingBankCount > 0 && <span className="text-red-600">{missingBankCount} mouvement(s) bancaire(s) orphelin(s)</span>}
                </p>
              </div>
            </div>
            {pendingDocs.length > 0 && (
              <Link href="/documents" className="w-full sm:w-auto">
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white text-xs w-full shadow-sm">Traiter les pièces</Button>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* 4 CARTE KPI FINANCIÈRES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white p-5 rounded-2xl border border-gray-200/60 shadow-sm hover:shadow-md transition-shadow group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-gray-400 tracking-wider uppercase">Chiffre d'Affaires HT</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform"><TrendingUp className="h-4 w-4" /></div>
          </div>
          <p className="text-3xl font-black text-gray-900 tracking-tight">{formatCurrency(totalIncomeHt)}</p>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-gray-400">Total TTC facturé</span>
            <span className="font-medium text-gray-600">{formatCurrency(totalIncomeTtc)}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200/60 shadow-sm hover:shadow-md transition-shadow group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-gray-400 tracking-wider uppercase">Dépenses (Achats)</span>
            <div className="p-2 bg-orange-50 text-orange-600 rounded-xl group-hover:scale-110 transition-transform"><TrendingDown className="h-4 w-4" /></div>
          </div>
          <p className="text-3xl font-black text-gray-900 tracking-tight">{formatCurrency(totalExpenseHt)}</p>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-gray-400">Sorties TTC</span>
            <span className="font-medium text-gray-600">{formatCurrency(totalExpenseTtc)}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200/60 shadow-sm hover:shadow-md transition-shadow group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-gray-400 tracking-wider uppercase">Marge Brute</span>
            <div className={`p-2 rounded-xl group-hover:scale-110 transition-transform ${isMargeSaine ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}><PieChart className="h-4 w-4" /></div>
          </div>
          <div className="flex items-end gap-3">
            <p className="text-3xl font-black text-gray-900 tracking-tight">{formatCurrency(soldeMarge)}</p>
            {totalIncomeHt > 0 && (
              <span className={`mb-1 text-sm font-bold px-2 py-0.5 rounded-md ${isMargeSaine ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                {margePercent.toFixed(1)}%
              </span>
            )}
          </div>
          <div className="mt-2 text-xs text-gray-400">Objectif BTP : &gt; 15%</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200/60 shadow-sm hover:shadow-md transition-shadow group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-gray-400 tracking-wider uppercase">TVA estimée</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl group-hover:scale-110 transition-transform"><Euro className="h-4 w-4" /></div>
          </div>
          <p className="text-3xl font-black text-purple-950 tracking-tight">{formatCurrency(vatNetToPay)}</p>
          <div className="mt-2 text-[11px] flex justify-between text-gray-500 font-medium">
            <span className="text-emerald-600">+ {formatCurrency(vatCollected)}</span>
            <span className="text-orange-600">- {formatCurrency(vatDeductible)}</span>
          </div>
        </div>
      </div>

      {/* COLONNES DU BAS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200/60 p-6 shadow-sm flex flex-col h-full">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-900 flex items-center gap-2"><Building2 className="h-5 w-5 text-blue-600" /> Chantiers actifs</h3>
            <Link href="/chantiers"><Button variant="ghost" size="sm" className="h-8 text-xs text-blue-600">Gérer</Button></Link>
          </div>
          {chantiers.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-6 text-gray-400">
              <Building2 className="h-10 w-10 mb-2 opacity-20" />
              <p className="text-sm font-medium">Aucun chantier en cours</p>
            </div>
          ) : (
            <div className="space-y-4">
              {chantiers.map(c => (
                <div key={c.id} className="group p-3 bg-gray-50/50 rounded-xl border border-gray-100">
                  <p className="font-bold text-gray-900 text-sm truncate">{c.name}</p>
                  <div className="flex justify-between items-center mt-1">
                    <p className="text-xs text-gray-500 truncate">{c.client_name || 'Client inconnu'}</p>
                    <p className="text-xs font-bold text-blue-700">{formatCurrency(c.budget_ht)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200/60 p-6 shadow-sm flex flex-col h-full">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-900 flex items-center gap-2"><Clock className="h-5 w-5 text-amber-500" /> À vérifier ({pendingDocs.length})</h3>
            <Link href="/documents"><Button variant="ghost" size="sm" className="h-8 text-xs text-amber-600">Voir tout</Button></Link>
          </div>
          {pendingDocs.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
              <CheckCircle2 className="h-10 w-10 text-emerald-400 mb-2" />
              <p className="font-bold text-gray-900 text-sm">À jour !</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingDocs.map((doc) => (
                <Link key={doc.id} href={`/documents/${doc.id}`} className="block">
                  <div className="flex items-center justify-between p-3 bg-white hover:bg-amber-50/30 rounded-xl border border-gray-100 transition-all">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{doc.extracted_data?.third_party_name || doc.file_name}</p>
                      <p className="text-xs text-gray-500">{formatDate(doc.created_at)}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200/60 p-6 shadow-sm flex flex-col h-full">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-900 flex items-center gap-2"><Receipt className="h-5 w-5 text-gray-400" /> Historique récent</h3>
            <Link href="/transactions"><Button variant="ghost" size="sm" className="h-8 text-xs text-gray-600">Voir tout</Button></Link>
          </div>
          {transactions.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-6 text-gray-400">
              <Receipt className="h-10 w-10 mb-2 opacity-20" />
              <p className="text-sm font-medium">Aucune opération</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-1.5 rounded-lg shrink-0 ${t.transaction_type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-600'}`}>
                      {t.transaction_type === 'income' ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{t.third_party_name || 'Inconnu'}</p>
                      <p className="text-[10px] text-gray-400">{formatDate(t.transaction_date || t.created_at)}</p>
                    </div>
                  </div>
                  <p className="font-bold text-gray-900 text-sm shrink-0 pl-2">{formatCurrency(t.amount_ttc)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
