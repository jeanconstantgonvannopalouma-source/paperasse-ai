'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Download,
  FileText,
  Building,
  AlertCircle,
  Loader2,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react'

interface TxRow {
  id: string
  transaction_date: string
  third_party_name: string
  transaction_type: string
  amount_ht: number
  vat_amount: number
  amount_ttc: number
  invoice_number: string
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount || 0)
}

export default function ExpertComptablePortalPage() {
  const params = useParams()
  const token = params?.token as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [org, setOrg] = useState<any>(null)
  const [transactions, setTransactions] = useState<TxRow[]>([])

  const loadPortalData = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/accountant/portal?token=${token}`)
      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error || "Lien d'accès invalide ou expiré.")
        setLoading(false)
        return
      }

      setOrg(data.org)
      setTransactions(data.transactions || [])
    } catch (err: any) {
      setError(err.message || "Impossible d'accéder au portail comptable")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadPortalData()
  }, [loadPortalData])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600 mx-auto" />
          <p className="text-sm text-gray-500">Chargement de l'espace expert-comptable...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl border border-red-200 max-w-md text-center space-y-4 shadow-sm">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
          <h2 className="text-lg font-bold text-gray-900">Accès Refusé</h2>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  const totalIncome = transactions.filter((t) => t.transaction_type === 'income').reduce((sum, t) => sum + Number(t.amount_ttc || 0), 0)
  const totalExpense = transactions.filter((t) => t.transaction_type !== 'income').reduce((sum, t) => sum + Number(t.amount_ttc || 0), 0)

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8 space-y-6">
      {/* Top Banner */}
      <div className="max-w-6xl mx-auto bg-slate-900 text-white p-6 rounded-2xl shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-amber-500 text-slate-950 rounded-xl font-bold">
            <Building className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{org?.name || 'Entreprise BTP'}</h1>
              <span className="bg-slate-800 text-amber-400 text-xs px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" /> Portail Expert-Comptable
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              SIRET : {org?.siret || 'Non renseigné'} • Espace de téléchargement des pièces
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadPortalData} className="border-slate-700 text-white hover:bg-slate-800 gap-1.5 text-xs">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Actualiser
          </Button>

          <a href="/api/exports/fec" download>
            <Button className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold gap-2">
              <Download className="h-4 w-4" />
              Télécharger le FEC (.txt)
            </Button>
          </a>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-6">
        {/* Cartes Synthèse */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-1">
            <p className="text-xs text-gray-500 uppercase font-medium">Écritures Validées</p>
            <p className="text-2xl font-bold text-gray-900">{transactions.length}</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-1">
            <p className="text-xs text-gray-500 uppercase font-medium">Total Recettes TTC</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-1">
            <p className="text-xs text-gray-500 uppercase font-medium">Total Dépenses TTC</p>
            <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalExpense)}</p>
          </div>
        </div>

        {/* Tableau des Écritures */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm p-6 space-y-4">
          <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
            <FileText className="h-5 w-5 text-amber-600" />
            Écritures Comptables de l'Entreprise
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-[11px] font-semibold">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">N° Pièce</th>
                  <th className="px-4 py-3">Tiers (Fournisseur/Client)</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Montant HT</th>
                  <th className="px-4 py-3 text-right">TVA</th>
                  <th className="px-4 py-3 text-right">Montant TTC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {t.transaction_date ? new Date(t.transaction_date).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{t.invoice_number || '—'}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{t.third_party_name || 'Inconnu'}</td>
                    <td className="px-4 py-3 capitalize text-xs">{t.transaction_type}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(t.amount_ht)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(t.vat_amount)}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(t.amount_ttc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
