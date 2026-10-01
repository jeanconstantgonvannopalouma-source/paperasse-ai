'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Search, ArrowUpRight, ArrowDownRight, RefreshCw, FileText, Trash2, Building2, Pencil, X, Receipt } from 'lucide-react'

interface Tx {
  id: string
  third_party_name: string | null
  transaction_type: string
  invoice_number: string | null
  transaction_date: string | null
  amount_ht: number | null
  vat_amount: number | null
  amount_ttc: number | null
  validation_status: string | null
  chantier_id: string | null
  chantiers?: { id: string; name: string } | null
}

function euro(n: number | null | undefined) {
  if (n === null || n === undefined) return '0,00 €'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0)
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d))
}

// Traduction française des types comptables
function formatType(type: string): { label: string; color: string } {
  switch ((type || '').toLowerCase()) {
    case 'income': return { label: 'Recette', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    case 'expense': return { label: 'Dépense', color: 'bg-orange-50 text-orange-700 border-orange-200' }
    case 'receipt': return { label: 'Ticket', color: 'bg-amber-50 text-amber-700 border-amber-200' }
    default: return { label: type || 'Autre', color: 'bg-gray-100 text-gray-700 border-gray-200' }
  }
}

export default function TransactionsPage() {
  const [items, setItems] = useState<Tx[]>([])
  const [chantiers, setChantiers] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  const [editTx, setEditTx] = useState<Tx | null>(null)
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/transactions')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setItems(data.transactions || [])

      const chRes = await fetch('/api/chantiers')
      const chData = await chRes.json()
      setChantiers(chData.chantiers || [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleDelete = async (id: string, label: string) => {
    if (!window.confirm(`Supprimer l'écriture "${label}" définitivement ?`)) return
    try {
      const res = await fetch('/api/transactions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error('Erreur de suppression')
      setItems((prev) => prev.filter((t) => t.id !== id))
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erreur')
    }
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editTx) return
    setSaving(true)
    try {
      const res = await fetch('/api/transactions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editTx.id, chantier_id: editTx.chantier_id }),
      })
      if (!res.ok) throw new Error('Erreur modification')
      await loadData()
      setEditTx(null)
    } catch (err) {
      alert('Erreur lors de la modification')
    } finally {
      setSaving(false)
    }
  }

  const filtered = items.filter((t) => {
    const q = search.toLowerCase()
    const okQ = !q || (t.third_party_name || '').toLowerCase().includes(q) || (t.chantiers?.name || '').toLowerCase().includes(q)
    const okT = typeFilter === 'all' || t.transaction_type === typeFilter
    return okQ && okT
  })

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Receipt className="h-7 w-7 text-amber-600" /> Transactions
          </h1>
          <p className="text-sm text-gray-500 mt-1">Historique et suivi comptable de vos dépenses, recettes et tickets de caisse BTP.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={loadData} disabled={loading} className="gap-2 text-gray-500 hover:text-gray-900">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-amber-600' : ''}`} /> Actualiser
          </Button>
          <Link href="/documents">
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white gap-2 font-medium shadow-sm">
              <FileText className="h-4 w-4" /> Documents
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white p-4 rounded-xl border flex flex-col sm:flex-row gap-3 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input className="pl-9" placeholder="Rechercher par tiers, chantier..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Tous les types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            <SelectItem value="income">Recettes</SelectItem>
            <SelectItem value="expense">Dépenses</SelectItem>
            <SelectItem value="receipt">Tickets</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="bg-white p-16 rounded-xl border text-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600 mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-16 rounded-xl border text-center space-y-3">
          <Receipt className="h-10 w-10 text-amber-600 mx-auto" />
          <p className="text-sm text-gray-500">Aucune transaction pour le moment.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Tiers</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Chantier</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Montant HT</th>
                  <th className="px-4 py-3 text-right">TVA</th>
                  <th className="px-4 py-3 text-right">Montant TTC</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((t) => {
                  const typeInfo = formatType(t.transaction_type)
                  return (
                    <tr key={t.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-1.5 rounded-lg shrink-0 ${t.transaction_type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                            {t.transaction_type === 'income' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                          </div>
                          <span className="font-semibold text-gray-900">{t.third_party_name || 'Inconnu'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold border ${typeInfo.color}`}>
                          {typeInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {t.chantiers?.name ? (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 max-w-[180px] truncate">
                            <Building2 className="h-3 w-3 shrink-0" /> {t.chantiers.name}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Non rattaché</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{formatDate(t.transaction_date)}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-700">{euro(t.amount_ht)}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-gray-500">{euro(t.vat_amount)}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">{euro(t.amount_ttc)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setEditTx(t)} className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(t.id, t.third_party_name || '')} className="h-8 w-8 p-0 text-red-600 hover:bg-red-50">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-gray-50 border-t text-xs text-gray-500">
            Affichage de <strong>{filtered.length}</strong> transaction(s) sur {items.length}
          </div>
        </div>
      )}

      {/* Modal de modification chantier */}
      {editTx && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold flex items-center gap-2">
                <Pencil className="h-4 w-4 text-blue-600" /> Modifier l'écriture
              </h3>
              <button onClick={() => setEditTx(null)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 text-sm">
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs space-y-1">
                <p className="font-bold text-gray-900">{editTx.third_party_name}</p>
                <p className="text-gray-500">Montant : {euro(editTx.amount_ttc)} TTC</p>
              </div>
              <div>
                <Label>Chantier rattaché</Label>
                <Select value={editTx.chantier_id || 'none'} onValueChange={(v) => setEditTx({ ...editTx, chantier_id: v === 'none' ? null : v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Aucun chantier" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun chantier</SelectItem>
                    {chantiers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-2">Réaffectez cette écriture au bon chantier pour corriger vos marges.</p>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="ghost" onClick={() => setEditTx(null)}>Annuler</Button>
                <Button type="submit" disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-white">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enregistrer'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}