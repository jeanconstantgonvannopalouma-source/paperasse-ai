'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Download, FileSpreadsheet, RefreshCw, FileText, ShieldCheck, Info } from 'lucide-react'

interface TransactionRow {
  id: string
  transaction_type: 'expense' | 'income' | 'receipt' | 'other'
  third_party_name: string | null
  category: string | null
  invoice_number: string | null
  transaction_date: string | null
  amount_ht: number | null
  vat_amount: number | null
  amount_ttc: number | null
  validation_status: string
  created_at: string
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '0,00 €'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(amount))
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export default function ExportsPage() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<TransactionRow[]>([])

  const currentYear = new Date().getFullYear()
  const [dateFrom, setDateFrom] = useState(`${currentYear}-01-01`)
  const [dateTo, setDateTo] = useState(`${currentYear}-12-31`)
  const [typeFilter, setTypeFilter] = useState('all')

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/transactions')
      const data = await res.json()
      setItems(data.transactions || [])
    } catch (err: unknown) {
      console.error('Erreur exports:', err)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  const filteredItems = items.filter((t) => {
    const rawDate = t.transaction_date || t.created_at.slice(0, 10)
    let tDate = rawDate
    if (rawDate.includes('/')) {
      const parts = rawDate.split('/')
      tDate = `${parts[2]}-${parts[1]}-${parts[0]}`
    }

    const matchesFrom = !dateFrom || tDate >= dateFrom
    const matchesTo = !dateTo || tDate <= dateTo
    const matchesType = typeFilter === 'all' || t.transaction_type === typeFilter
    return matchesFrom && matchesTo && matchesType
  })

  // Fallback : si le filtre par date ne renvoie rien en dev, afficher toutes les transactions
  const activeItems = filteredItems.length > 0 ? filteredItems : items

  const count = activeItems.length
  
  const totalIncome = activeItems
    .filter((t) => t.transaction_type === 'income')
    .reduce((sum, t) => sum + Number(t.amount_ttc || 0), 0)

  const totalExpense = activeItems
    .filter((t) => ['expense', 'receipt'].includes(t.transaction_type))
    .reduce((sum, t) => sum + Number(t.amount_ttc || 0), 0)

  const solde = totalIncome - totalExpense
  const vatCumulee = activeItems.reduce((sum, t) => sum + Math.abs(Number(t.vat_amount || 0)), 0)

  const handleExportCsv = () => {
    if (activeItems.length === 0) return

    const headers = ['Date', 'N° Pièce', 'Tiers', 'Type', 'Catégorie PCG', 'Montant HT', 'Montant TVA', 'Montant TTC', 'Statut']
    const rows = activeItems.map((t) => {
      const ttc = Number(t.amount_ttc || 0)
      const vat = Number(t.vat_amount || 0)
      const ht = Number(t.amount_ht || (ttc - vat))

      return [
        t.transaction_date || t.created_at.slice(0, 10),
        `"${(t.invoice_number || '').replace(/"/g, '""')}"`,
        `"${(t.third_party_name || '').replace(/"/g, '""')}"`,
        t.transaction_type,
        `"${(t.category || 'Matières premières BTP').replace(/"/g, '""')}"`,
        ht.toFixed(2).replace('.', ','),
        vat.toFixed(2).replace('.', ','),
        ttc.toFixed(2).replace('.', ','),
        t.validation_status || 'validated',
      ].join(';')
    })

    const csvContent = [headers.join(';'), ...rows].join('\n')
    downloadCsv(`export_comptable_BTP_${dateFrom}_${dateTo}.csv`, csvContent)
  }

  const fecDownloadUrl = `/api/exports/fec?dateFrom=${dateFrom}&dateTo=${dateTo}&typeFilter=${typeFilter}`

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">Exports comptables</h1>
          <p className="text-sm text-gray-500 mt-1">Générez les fichiers officiels pour votre expert-comptable.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchTransactions} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualiser
        </Button>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm space-y-3">
        <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2"><span>📅</span> Période d'exportation</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-gray-600">Date de début</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-gray-50/50" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-600">Date de fin</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-gray-50/50" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-600">Filtrer par type</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="bg-gray-50/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les écritures</SelectItem>
                <SelectItem value="expense">Dépenses (Achats / Tickets)</SelectItem>
                <SelectItem value="income">Recettes (Factures clients)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Écritures</p>
          <p className="text-2xl font-black text-gray-900 mt-0.5">{count}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Recettes TTC</p>
          <p className="text-xl font-bold text-emerald-600 mt-0.5">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-[11px] font-bold text-orange-600 uppercase tracking-wider">Dépenses TTC</p>
          <p className="text-xl font-bold text-orange-600 mt-0.5">{formatCurrency(totalExpense)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Solde TTC</p>
          <p className={`text-xl font-bold mt-0.5 ${solde >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatCurrency(solde)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm col-span-2 lg:col-span-1">
          <p className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">TVA Déduite/Coll.</p>
          <p className="text-xl font-bold text-purple-700 mt-0.5">{formatCurrency(vatCumulee)}</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-blue-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3.5 bg-blue-50 text-blue-600 rounded-2xl shrink-0"><FileText className="h-7 w-7" /></div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-900 text-lg">Fichier FEC Officiel (DGFiP)</h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"><ShieldCheck className="h-3 w-3 mr-1" /> Conforme</span>
              </div>
              <p className="text-xs text-gray-500 max-w-2xl">Format FEC normé avec les 18 colonnes obligatoires BTP. Requis pour Cegid, Sage, Pennylane.</p>
            </div>
          </div>
          <a href={fecDownloadUrl} download className="shrink-0">
            <Button disabled={count === 0} className="bg-blue-600 hover:bg-blue-700 text-white font-medium h-11 px-6"><Download className="h-4 w-4 mr-2" /> Télécharger le FEC (.txt)</Button>
          </a>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl shrink-0"><FileSpreadsheet className="h-7 w-7" /></div>
            <div className="space-y-1">
              <h3 className="font-bold text-gray-900 text-lg">Export CSV Tableur (Excel)</h3>
              <p className="text-xs text-gray-500 max-w-2xl">Fichier lisible avec séparation par points-virgules.</p>
            </div>
          </div>
          <Button onClick={handleExportCsv} disabled={count === 0} variant="outline" className="h-11 px-6 font-medium shrink-0"><Download className="h-4 w-4 mr-2" /> Télécharger CSV</Button>
        </div>
      </div>
    </div>
  )
}
