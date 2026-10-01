'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  Loader2,
  MapPin,
  Calendar,
  HardHat,
  FileText,
  Receipt,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Plus,
  User,
} from 'lucide-react'

interface Chantier {
  id: string
  organization_id: string
  name: string
  client_name: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  status: string
  start_date: string | null
  end_date: string | null
  budget_ht: number | null
  notes: string | null
  created_at: string
}

interface TxItem {
  id: string
  document_id: string | null
  transaction_type: 'expense' | 'income' | 'receipt' | 'other'
  third_party_name: string | null
  category: string | null
  invoice_number: string | null
  transaction_date: string | null
  amount_ht: number
  vat_amount: number
  amount_ttc: number
  payment_status: string
  validation_status: string
  created_at: string
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) {
    return '0,00 €'
  }
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(amount))
}

export default function ChantierDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const supabase = createClient()

  const chantierId = params?.id as string

  const [chantier, setChantier] = useState<Chantier | null>(null)
  const [transactions, setTransactions] = useState<TxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchChantierData = useCallback(async () => {
    if (!user || !chantierId) return
    setLoading(true)
    setError(null)

    try {
      const { data: chantierData, error: chantierErr } = await supabase
        .from('chantiers')
        .select('*')
        .eq('id', chantierId)
        .single()

      if (chantierErr) throw chantierErr
      setChantier(chantierData)

      const { data: txData } = await supabase
        .from('transactions')
        .select('*')
        .eq('chantier_id', chantierId)
        .order('transaction_date', { ascending: false })

      setTransactions((txData as TxItem[]) || [])
    } catch (err: any) {
      console.error('Erreur chargement chantier:', err)
      setError(err.message || 'Impossible de charger le chantier')
    } finally {
      setLoading(false)
    }
  }, [user, chantierId, supabase])

  useEffect(() => {
    fetchChantierData()
  }, [fetchChantierData])

  const budgetHt = chantier?.budget_ht || 0

  const totalExpenseHt = transactions
    .filter((t) => t.transaction_type === 'expense' || t.transaction_type === 'receipt')
    .reduce((sum, t) => sum + Number(t.amount_ht || 0), 0)

  const totalIncomeHt = transactions
    .filter((t) => t.transaction_type === 'income')
    .reduce((sum, t) => sum + Number(t.amount_ht || 0), 0)

  const margeHt = totalIncomeHt > 0 ? (totalIncomeHt - totalExpenseHt) : (budgetHt - totalExpenseHt)
  const consumedPercent = budgetHt > 0 ? Math.min(100, Math.round((totalExpenseHt / budgetHt) * 100)) : 0

  if (loading) {
    return (
      <div className="p-12 text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600 mx-auto" />
        <p className="text-sm text-gray-500">Chargement du suivi de chantier...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/chantiers">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{chantier?.name || 'Chantier'}</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 capitalize">
                {chantier?.status || 'En cours'}
              </span>
            </div>
            <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
              <User className="h-3.5 w-3.5" /> Client: {chantier?.client_name || 'Non renseigné'}
              {chantier?.city && (
                <>
                  <span>•</span>
                  <MapPin className="h-3.5 w-3.5" /> {chantier.city}
                </>
              )}
            </p>
          </div>
        </div>

        <Link href="/documents/upload">
          <Button className="bg-amber-600 hover:bg-amber-700 text-white gap-2">
            <Plus className="h-4 w-4" />
            Lier un document / facture
          </Button>
        </Link>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Rentabilité */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase">Budget HT Prévu</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(budgetHt)}</p>
          <p className="text-xs text-gray-400">Objectif initial</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase">Achats & Dépenses HT</p>
          <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalExpenseHt)}</p>
          <p className="text-xs text-gray-400">{consumedPercent}% du budget consommé</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase">Facturé au Client HT</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalIncomeHt)}</p>
          <p className="text-xs text-gray-400">Factures validées</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase">Marge Nette Estimée HT</p>
          <div className="flex items-center justify-between">
            <p className={margeHt >= 0 ? 'text-2xl font-bold text-green-600' : 'text-2xl font-bold text-red-600'}>
              {formatCurrency(margeHt)}
            </p>
            {margeHt >= 0 ? (
              <TrendingUp className="h-5 w-5 text-green-600" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-600" />
            )}
          </div>
          <p className="text-xs text-gray-400">Marge résiduelle</p>
        </div>
      </div>

      {/* Transactions */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm space-y-4 p-6">
        <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <Receipt className="h-5 w-5 text-amber-600" />
          Pièces et Achats Rattachés ({transactions.length})
        </h3>

        {transactions.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm border-2 border-dashed rounded-xl">
            <p>Aucune dépense ni facture n'est rattachée à ce chantier.</p>
            <p className="text-xs mt-1 text-gray-400">
              Validez un document en sélectionnant ce chantier dans la liste.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-[11px] font-semibold">
                <tr>
                  <th className="px-4 py-3">Tiers / Fournisseur</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">N° Pièce</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Montant HT</th>
                  <th className="px-4 py-3 text-right">Montant TTC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-900">{t.third_party_name || 'Inconnu'}</td>
                    <td className="px-4 py-3 capitalize text-xs">
                      <span className={t.transaction_type === 'income' ? 'px-2 py-1 rounded-md bg-green-50 text-green-700 border border-green-200' : 'px-2 py-1 rounded-md bg-orange-50 text-orange-700 border border-orange-200'}>
                        {t.transaction_type === 'income' ? 'Recette' : 'Dépense'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{t.invoice_number || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {t.transaction_date ? new Date(t.transaction_date).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(t.amount_ht)}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(t.amount_ttc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
)
}