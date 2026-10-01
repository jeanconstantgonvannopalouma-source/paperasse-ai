const fs = require('fs');
const path = 'app/(app)/chantiers/[id]/page.tsx';

const content = `'use client'

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
  Euro,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
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

interface DocItem {
  id: string
  file_name: string
  status: string
  document_type: string | null
  extracted_data: any
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
  const [documents, setDocuments] = useState<DocItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchChantierData = useCallback(async () => {
    if (!user || !chantierId) return
    setLoading(true)
    setError(null)

    try {
      // 1. Infos du chantier
      const { data: chantierData, error: chantierErr } = await supabase
        .from('chantiers')
        .select('*')
        .eq('id', chantierId)
        .single()

      if (chantierErr) throw chantierErr
      setChantier(chantierData)

      // 2. Transactions liées
      const { data: txData } = await supabase
        .from('transactions')
        .select('*')
        .eq('chantier_id', chantierId)
        .order('transaction_date', { ascending: false })

      setTransactions((txData as TxItem[]) || [])

      // 3. Documents liés
      const { data: docData } = await supabase
        .from('documents')
        .select('*')
        .eq('chantier_id', chantierId)
        .order('created_at', { ascending: false })

      setDocuments((docData as DocItem[]) || [])
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

  // Calculs Financiers de Rentabilité
  const budgetHt = chantier?.budget_ht || 0

  const totalExpenseHt = transactions
    .filter((t) => t.transaction_type === 'expense' || t.transaction_type === 'receipt')
    .reduce((sum, t) => sum + Number(t.amount_ht || 0), 0)

  const totalIncomeHt = transactions
    .filter((t) => t.transaction_type === 'income')
    .reduce((sum, t) => sum + Number(t.amount_ht || 0), 0)

  // Marge Brute HT
  const margeHt = totalIncomeHt > 0 ? (totalIncomeHt - totalExpenseHt) : (budgetHt - totalExpenseHt)
  const consumedPercent = budgetHt > 0 ? Math.min(100, Math.round((totalExpenseHt / budgetHt) * 100)) : 0

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/chantiers">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{chantier?.name || 'Chargement...'}</h1>
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

      {/* Cartes KPI de Rentabilité */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Budget HT */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase">Budget HT Prévu</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(budgetHt)}</p>
          <p className="text-xs text-gray-400">Objectif du chantier</p>
        </div>

        {/* Dépenses HT */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase">Acheter & Dépenses HT</p>
          <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalExpenseHt)}</p>
          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full ${consumedPercent > 90 ? 'bg-red-500' : 'bg-orange-500'}`}
              style={{ width: `${consumedPercent}%` }}
            />
          </div>
        </div>

        {/* Recettes Facturées HT */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase">Facturé au Client HT</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalIncomeHt)}</p>
          <p className="text-xs text-gray-400">{transactions.filter(t => t.transaction_type === 'income').length} facture(s) d'avancement</p>
        </div>

        {/* Marge Nette HT */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase">Marge Nette Estimée</p>
          <div className="flex items-center justify-between">
            <p className={`text-2xl font-bold ${margeHt >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(margeHt)}
            </p>
            {margeHt >= 0 ? (
              <TrendingUp className="h-5 w-5 text-green-600" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-600" />
            )}
          </div>
          <p className="text-xs text-gray-400">
            {consumedPercent}% du budget dépensé
          </p>
        </div>
      </div>

      {/* Liste des Transactions du Chantier */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm space-y-4 p-6">
        <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <Receipt className="h-5 w-5 text-amber-600" />
          Dépenses et Recettes Rattachées ({transactions.length})
        </h3>

        {transactions.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm border-2 border-dashed rounded-xl">
            <p>Aucune dépense ni facture n'est encore rattachée à ce chantier.</p>
            <p className="text-xs mt-1 text-gray-400">
              Lors de la validation d'un document, sélectionnez "{chantier?.name}" dans la liste déroulante.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-[11px] font-semibold">
                <tr>
                  <th className="px-4 py-3">Tiers / Fournisseur</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Réf / N°</th>
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
                      <span className={`px-2 py-1 rounded-md border ${t.transaction_type === 'income' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
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
'

fs.writeFileSync(path, content, 'utf8')
console.log('✅ Page chantiers/[id]/page.tsx mise à jour avec le suivi de marge !')
