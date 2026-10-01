'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Loader2,
  Landmark,
  Upload,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FileCheck,
  FileX,
  Link as LinkIcon,
  EyeOff,
  X,
  Search,
  Plus,
  Info,
} from 'lucide-react'

interface BankTx {
  id: string
  bank_date: string
  label: string
  amount: number
  status: 'matched' | 'unmatched' | 'ignored'
  matched_transaction_id: string | null
  created_at: string
}

interface TxOption {
  id: string
  third_party_name: string | null
  amount_ttc: number
  invoice_number: string | null
  transaction_date: string | null
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '0,00 €'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(amount))
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—'
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(dateString))
}

function daysBetween(a: string, b: string): number {
  const d1 = new Date(a).getTime()
  const d2 = new Date(b).getTime()
  if (Number.isNaN(d1) || Number.isNaN(d2)) return 999
  return Math.abs(Math.round((d1 - d2) / (1000 * 60 * 60 * 24)))
}

export default function BanquePage() {
  const supabase = createClient()

  const [items, setItems] = useState<BankTx[]>([])
  const [allTransactions, setAllTransactions] = useState<TxOption[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'unmatched' | 'matched' | 'ignored'>('all')

  const [matchingBankTx, setMatchingBankTx] = useState<BankTx | null>(null)
  const [selectedTxId, setSelectedTxId] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const fetchBankTransactions = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/bank')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur lors du chargement bancaire')
      setItems((data.transactions as BankTx[]) || [])

      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('id, third_party_name, amount_ttc, invoice_number, transaction_date')
        .order('transaction_date', { ascending: false })

      if (txError) throw txError
      setAllTransactions((txData as TxOption[]) || [])
    } catch (err: unknown) {
      console.error('Erreur banque:', err)
      setError(err instanceof Error ? err.message : 'Impossible de charger les lignes bancaires')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchBankTransactions()
  }, [fetchBankTransactions])

  // Auto-dismiss success
  useEffect(() => {
    if (!successMsg) return
    const t = setTimeout(() => setSuccessMsg(null), 4000)
    return () => clearTimeout(t)
  }, [successMsg])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]

    setUploading(true)
    setError(null)
    setSuccessMsg(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/bank/import', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'importation")

      setSuccessMsg(data.message || 'Relevé importé avec succès')
      await fetchBankTransactions()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur import bancaire')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleAction = async (
    bankTxId: string,
    action: 'match' | 'ignore' | 'unmatch',
    transactionId?: string
  ) => {
    setActionLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/bank/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankTxId, action, transactionId }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'action")

      setSuccessMsg(data.message || 'Action effectuée')
      setMatchingBankTx(null)
      setSelectedTxId('')
      await fetchBankTransactions()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors du traitement')
    } finally {
      setActionLoading(false)
    }
  }

  const openMatchModal = (item: BankTx) => {
    setMatchingBankTx(item)
    setSelectedTxId('')
  }

  // Suggestions intelligentes : montant proche + date proche
  const suggestedMatches = useMemo(() => {
    if (!matchingBankTx) return [] as Array<TxOption & { score: number; amountDiff: number; dayDiff: number }>

    const targetAmount = Math.abs(Number(matchingBankTx.amount))

    return allTransactions
      .map((tx) => {
        const amountDiff = Math.abs(Math.abs(Number(tx.amount_ttc || 0)) - targetAmount)
        const dayDiff = tx.transaction_date
          ? daysBetween(tx.transaction_date, matchingBankTx.bank_date)
          : 30
        // Score plus bas = meilleur
        const score = amountDiff * 2 + dayDiff * 0.5
        return { ...tx, score, amountDiff, dayDiff }
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, 40)
  }, [matchingBankTx, allTransactions])

  const filteredItems = useMemo(() => {
    const q = search.toLowerCase().trim()
    return items.filter((item) => {
      const matchesSearch = !q || item.label.toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [items, search, statusFilter])

  const matchedCount = items.filter((i) => i.status === 'matched').length
  const missingCount = items.filter((i) => i.status === 'unmatched' && i.amount < 0).length
  const ignoredCount = items.filter((i) => i.status === 'ignored').length
  const matchRate = items.length > 0 ? Math.round((matchedCount / items.length) * 100) : 0

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Landmark className="h-7 w-7 text-amber-600" />
            Rapprochement bancaire
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Importez votre relevé CSV, détectez les tickets manquants et rattachez vos justificatifs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchBankTransactions}
            disabled={loading}
            className="gap-2 text-gray-500 hover:text-gray-900"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-amber-600' : ''}`} />
            Actualiser
          </Button>

          <label className="inline-block cursor-pointer">
            <Input
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              onChange={handleFileUpload}
              className="hidden"
              disabled={uploading}
            />
            <div className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Importer un relevé (CSV)
            </div>
          </label>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200/70 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Lignes importées</p>
          <p className="text-3xl font-black text-gray-900 mt-1 tracking-tight">{items.length}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-emerald-200/70 shadow-sm">
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Rapprochées</p>
          <p className="text-3xl font-black text-emerald-700 mt-1 tracking-tight flex items-center gap-2">
            <FileCheck className="h-6 w-6" />
            {matchedCount}
          </p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-red-200/70 shadow-sm">
          <p className="text-xs font-bold text-red-600 uppercase tracking-wider">Tickets manquants</p>
          <p className="text-3xl font-black text-red-700 mt-1 tracking-tight flex items-center gap-2">
            <FileX className="h-6 w-6" />
            {missingCount}
          </p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-blue-200/70 shadow-sm">
          <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Taux de rapprochement</p>
          <p className="text-3xl font-black text-blue-700 mt-1 tracking-tight">{matchRate}%</p>
          <p className="text-[11px] text-gray-400 mt-1">{ignoredCount} ligne(s) ignorée(s)</p>
        </div>
      </div>

      {/* Filtres */}
      {items.length > 0 && (
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              className="pl-9"
              placeholder="Rechercher un libellé bancaire (ex: LEROY, POINT P, TOTAL...)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={(v: 'all' | 'unmatched' | 'matched' | 'ignored') => setStatusFilter(v)}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="unmatched">Non rapprochés</SelectItem>
              <SelectItem value="matched">Rapprochés</SelectItem>
              <SelectItem value="ignored">Ignorés</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Contenu */}
      {loading ? (
        <div className="bg-white p-16 rounded-2xl border border-gray-200 text-center space-y-3 shadow-sm">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600 mx-auto" />
          <p className="text-sm text-gray-500">Chargement des opérations bancaires...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center space-y-5 shadow-sm">
          <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto">
            <Landmark className="h-8 w-8 text-amber-600" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-gray-900">Aucun relevé bancaire importé</h3>
            <p className="text-sm text-gray-500 max-w-lg mx-auto">
              Exportez le CSV de votre banque pro (Crédit Agricole, BP, Qonto, Shine, Boursorama Pro...) puis importez-le ici pour détecter automatiquement les dépenses sans justificatif.
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left max-w-xl mx-auto text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-blue-600" /> Format conseillé
            </p>
            <p>Colonnes typiques : Date ; Libellé ; Montant (ou Débit / Crédit)</p>
            <p>Encodage UTF-8 ou Windows-1252 • séparateur `;` ou `,`</p>
          </div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center text-gray-500 shadow-sm">
          Aucune ligne ne correspond à vos filtres.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-[11px] font-semibold tracking-wider">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Libellé banque</th>
                  <th className="px-4 py-3 text-right">Montant</th>
                  <th className="px-4 py-3 text-center">Statut</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-4 py-3 text-gray-600 text-xs font-medium whitespace-nowrap">
                      {formatDate(item.bank_date)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900 max-w-[360px]">
                      <span className="line-clamp-2">{item.label}</span>
                    </td>
                    <td className={`px-4 py-3 text-right font-bold font-mono ${item.amount < 0 ? 'text-gray-900' : 'text-emerald-600'}`}>
                      {formatCurrency(item.amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.status === 'matched' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Rapproché
                        </span>
                      ) : item.status === 'ignored' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                          <EyeOff className="h-3.5 w-3.5" /> Ignoré
                        </span>
                      ) : item.amount < 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                          <FileX className="h-3.5 w-3.5" /> Ticket manquant
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          Encaissement
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {item.status === 'unmatched' && item.amount < 0 && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openMatchModal(item)}
                              className="text-xs gap-1 border-blue-200 text-blue-700 hover:bg-blue-50 h-8"
                            >
                              <LinkIcon className="h-3.5 w-3.5" /> Lier
                            </Button>
                            <Link href="/documents/upload">
                              <Button size="sm" variant="outline" className="text-xs gap-1 border-amber-200 text-amber-800 hover:bg-amber-50 h-8">
                                <Plus className="h-3.5 w-3.5" /> Justificatif
                              </Button>
                            </Link>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleAction(item.id, 'ignore')}
                              disabled={actionLoading}
                              className="text-xs gap-1 text-gray-500 hover:text-gray-800 h-8"
                            >
                              <EyeOff className="h-3.5 w-3.5" /> Ignorer
                            </Button>
                          </>
                        )}

                        {item.status !== 'unmatched' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleAction(item.id, 'unmatch')}
                            disabled={actionLoading}
                            className="text-xs text-gray-500 hover:text-gray-800 h-8"
                          >
                            Rétablir
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t bg-gray-50 text-xs text-gray-500">
            Affichage de <strong className="text-gray-700">{filteredItems.length}</strong> ligne(s) sur {items.length}
          </div>
        </div>
      )}

      {/* Modal de liaison intelligente */}
      {matchingBankTx && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <LinkIcon className="h-5 w-5 text-blue-600" />
                Lier la ligne bancaire
              </h3>
              <button
                onClick={() => setMatchingBankTx(null)}
                className="text-gray-400 hover:text-gray-700 bg-white p-1 rounded-md border shadow-sm"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-100 text-xs space-y-1">
                <p className="font-semibold text-blue-900 line-clamp-2">{matchingBankTx.label}</p>
                <p className="text-blue-700">
                  Montant : <strong>{formatCurrency(matchingBankTx.amount)}</strong>
                  {' • '}Date : {formatDate(matchingBankTx.bank_date)}
                </p>
              </div>

              <div className="space-y-2 text-sm">
                <label className="font-semibold text-gray-700 text-xs">
                  Pièce comptable correspondante (suggestions triées par proximité)
                </label>
                <Select value={selectedTxId} onValueChange={setSelectedTxId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir une écriture..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {suggestedMatches.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        Aucune écriture disponible
                      </SelectItem>
                    ) : (
                      suggestedMatches.map((tx) => {
                        const almostExact = tx.amountDiff < 0.05
                        return (
                          <SelectItem key={tx.id} value={tx.id}>
                            {almostExact ? '★ ' : ''}
                            {tx.third_party_name || 'Inconnu'} • {formatCurrency(tx.amount_ttc)}
                            {tx.transaction_date ? ` • ${formatDate(tx.transaction_date)}` : ''}
                            {tx.amountDiff >= 0.05 ? ` (écart ${formatCurrency(tx.amountDiff)})` : ' (montant exact)'}
                          </SelectItem>
                        )
                      })
                    )}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-gray-400">
                  Les meilleures suggestions apparaissent en premier (montant proche + date proche).
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" onClick={() => setMatchingBankTx(null)}>
                  Annuler
                </Button>
                <Button
                  type="button"
                  disabled={!selectedTxId || selectedTxId === '__none' || actionLoading}
                  onClick={() => handleAction(matchingBankTx.id, 'match', selectedTxId)}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-2 font-semibold"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Valider le rapprochement'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
