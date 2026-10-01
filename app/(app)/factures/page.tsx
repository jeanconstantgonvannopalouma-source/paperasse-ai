'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Plus, Search, FileText, RefreshCw, Building2, CheckCircle2, AlertCircle, Receipt } from 'lucide-react'

interface Invoice {
  id: string
  doc_type: 'facture' | 'devis'
  invoice_number: string
  client_name: string
  issue_date: string
  amount_ht: number
  amount_ttc: number
  status: string
  chantiers?: { id: string; name: string } | null
}

function euro(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '0,00 €'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(amount))
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—'
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(dateString))
}

export default function FacturesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'facture' | 'devis'>('all')

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Appel à la NOUVELLE API sécurisée (qui ne plantera pas sur les jointures)
      const res = await fetch('/api/transactions')
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.error || 'Erreur API')

      const allTx = data.transactions || []
      
      // On filtre les recettes et on les considère comme des factures
      const incomeTx = allTx.filter((t: any) => t.transaction_type === 'income')

      const formattedInvoices: Invoice[] = incomeTx.map((t: any) => ({
        id: t.id,
        doc_type: 'facture',
        invoice_number: t.invoice_number || `FACT-${t.id.slice(0, 6)}`,
        client_name: t.third_party_name || 'Client Inconnu',
        issue_date: t.transaction_date || t.created_at,
        amount_ht: t.amount_ht || (t.amount_ttc ? t.amount_ttc / 1.2 : 0),
        amount_ttc: t.amount_ttc || 0,
        status: 'paye',
        chantiers: t.chantiers || null,
      }))

      setInvoices(formattedInvoices)
    } catch (err: unknown) {
      console.error('Erreur chargement factures:', err)
      setError(err instanceof Error ? err.message : 'Impossible de charger vos factures')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInvoices()
  }, [fetchInvoices])

  const filtered = invoices.filter((inv) => {
    const q = search.toLowerCase().trim()
    const matchesSearch = !q || inv.invoice_number.toLowerCase().includes(q) || inv.client_name.toLowerCase().includes(q) || (inv.chantiers?.name || '').toLowerCase().includes(q)
    const matchesType = typeFilter === 'all' || inv.doc_type === typeFilter
    return matchesSearch && matchesType
  })

  const totalFactureHT = invoices.reduce((sum, i) => sum + Number(i.amount_ht || 0), 0)
  const totalFactureTTC = invoices.reduce((sum, i) => sum + Number(i.amount_ttc || 0), 0)

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Receipt className="h-7 w-7 text-amber-600" /> Factures & Devis Clients
          </h1>
          <p className="text-sm text-gray-500 mt-1">Gérez votre facturation commerciale BTP.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={fetchInvoices} disabled={loading} className="gap-2 text-gray-500 hover:text-gray-900">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-amber-600' : ''}`} /> Actualiser
          </Button>
          <Link href="/factures/nouvelle">
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white gap-2 font-semibold">
              <Plus className="h-4 w-4" /> Nouveau Devis / Facture
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="h-5 w-5 shrink-0" /><span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Chiffre Facturé HT</p>
          <p className="text-3xl font-black text-gray-900 mt-1">{euro(totalFactureHT)}</p>
          <p className="text-xs text-gray-400 mt-1">TTC : {euro(totalFactureTTC)}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border shadow-sm">
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Factures Émises</p>
          <p className="text-3xl font-black text-emerald-700 mt-1">{invoices.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-4 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Rechercher par n° de facture, client..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-amber-600 mb-2" />
            <span className="text-sm text-gray-500">Chargement...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center space-y-4">
            <FileText className="h-10 w-10 text-amber-600 mx-auto" />
            <h3 className="text-lg font-bold text-gray-900">Aucune facture</h3>
            <Link href="/factures/nouvelle">
              <Button className="bg-amber-600 hover:bg-amber-700 text-white mt-2">Éditer une facture client</Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3">N° Pièce & Client</th>
                  <th className="px-4 py-3">Chantier</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Montant HT</th>
                  <th className="px-4 py-3 text-right">TTC</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-mono font-bold text-gray-900 text-xs">{inv.invoice_number}</p>
                      <p className="font-semibold text-gray-700">{inv.client_name}</p>
                    </td>
                    <td className="px-4 py-3">
                      {inv.chantiers?.name ? (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-800 bg-amber-50 px-2 py-0.5 rounded border"><Building2 className="h-3 w-3" /> {inv.chantiers.name}</span>
                      ) : <span className="text-xs text-gray-400 italic">Non attribué</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{formatDate(inv.issue_date)}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">{euro(inv.amount_ht)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">{euro(inv.amount_ttc)}</td>
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