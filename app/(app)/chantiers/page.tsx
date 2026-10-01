'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Loader2, Plus, Search, MapPin, HardHat, X, Pencil, Trash2, RefreshCw,
  ExternalLink, User, AlertCircle, Calendar, TrendingDown, PieChart, ArrowUpRight
} from 'lucide-react'

type ChantierStatus = 'brouillon' | 'en_cours' | 'termine' | 'facture' | 'archive'

interface Chantier {
  id: string
  name: string
  client_name: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  status: ChantierStatus
  start_date: string | null
  end_date: string | null
  budget_ht: number | null
}

interface ChantierStats {
  expense: number
  income: number
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '0,00 €'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(amount))
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '—'
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(dateString))
}

const statusConfig: Record<ChantierStatus, { label: string; className: string }> = {
  brouillon: { label: 'Brouillon / Devis', className: 'bg-gray-100 text-gray-700 border-gray-200' },
  en_cours: { label: 'En cours', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  termine: { label: 'Terminé (À facturer)', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  facture: { label: 'Facturé & Soldé', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  archive: { label: 'Archivé', className: 'bg-slate-100 text-slate-500 border-slate-200' },
}

export default function ChantiersPage() {
  const { user } = useAuth()
  const supabase = createClient()

  const [chantiers, setChantiers] = useState<Chantier[]>([])
  const [statsMap, setStatsMap] = useState<Record<string, ChantierStats>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalError, setModalError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: '', client_name: '', address: '', city: '', postal_code: '',
    status: 'en_cours' as ChantierStatus, start_date: '', end_date: '', budget_ht: '', notes: '',
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/chantiers')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur chargement chantiers')
      setChantiers(data.chantiers || [])
      setStatsMap(data.stats || {})
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement')
      setChantiers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleOpenModal = (c?: Chantier) => {
    setModalError(null)
    if (c) {
      setEditingId(c.id)
      setForm({
        name: c.name || '', client_name: c.client_name || '', address: c.address || '', city: c.city || '', postal_code: c.postal_code || '',
        status: c.status || 'en_cours',
        start_date: c.start_date ? String(c.start_date).slice(0, 10) : '',
        end_date: c.end_date ? String(c.end_date).slice(0, 10) : '',
        budget_ht: c.budget_ht != null ? String(c.budget_ht) : '',
        notes: '',
      })
    } else {
      setEditingId(null)
      setForm({
        name: '', client_name: '', address: '', city: '', postal_code: '',
        status: 'en_cours', start_date: '', end_date: '', budget_ht: '', notes: '',
      })
    }
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setModalError('Le nom du chantier est obligatoire.'); return }
    setSaving(true)
    setModalError(null)
    try {
      const res = await fetch('/api/chantiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, ...form }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur sauvegarde')
      setShowModal(false)
      await loadData()
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Erreur sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Supprimer le chantier "${name}" ?`)) return
    try {
      const res = await fetch(`/api/chantiers?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur suppression')
      await loadData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erreur suppression')
    }
  }

  const filtered = chantiers.filter((c) => {
    const q = search.toLowerCase()
    const okQ = !q || c.name.toLowerCase().includes(q) || (c.client_name || '').toLowerCase().includes(q) || (c.city || '').toLowerCase().includes(q)
    const okS = statusFilter === 'all' || c.status === statusFilter
    return okQ && okS
  })

  const totalBudget = chantiers.reduce((a, c) => a + Number(c.budget_ht || 0), 0)
  const active = chantiers.filter((c) => c.status === 'en_cours').length
  const done = chantiers.filter((c) => c.status === 'termine' || c.status === 'facture').length

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">Chantiers & Projets</h1>
          <p className="text-sm text-gray-500 mt-1">Gérez vos travaux, pilotez vos budgets et suivez votre rentabilité.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={loadData} disabled={loading} className="gap-2 text-gray-500 hover:text-gray-900">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-amber-600' : ''}`} /> Actualiser
          </Button>
          <Button onClick={() => handleOpenModal()} className="bg-amber-600 hover:bg-amber-700 text-white gap-2 font-medium">
            <Plus className="h-4 w-4" /> Nouveau chantier
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex gap-2 items-center">
          <AlertCircle className="h-5 w-5" /> {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase">Total Chantiers</p>
          <p className="text-3xl font-black mt-1">{chantiers.length}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border shadow-sm border-blue-200/60 bg-blue-50/10">
          <p className="text-xs font-bold text-blue-500 uppercase">Actifs en cours</p>
          <p className="text-3xl font-black text-blue-700 mt-1">{active}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border shadow-sm border-emerald-200/60 bg-emerald-50/10">
          <p className="text-xs font-bold text-emerald-500 uppercase">À facturer / Terminés</p>
          <p className="text-3xl font-black text-emerald-700 mt-1">{done}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase">Budget Cumulé HT</p>
          <p className="text-3xl font-black mt-1">{formatCurrency(totalBudget)}</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border flex flex-col sm:flex-row gap-3 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input className="pl-9" placeholder="Rechercher un chantier, client, ville..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="en_cours">En cours</SelectItem>
            <SelectItem value="termine">Terminé</SelectItem>
            <SelectItem value="facture">Facturé</SelectItem>
            <SelectItem value="brouillon">Brouillon</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="bg-white p-16 rounded-2xl border text-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600 mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-16 rounded-2xl border text-center space-y-4">
          <HardHat className="h-10 w-10 text-amber-600 mx-auto" />
          <h3 className="text-lg font-bold">Aucun chantier trouvé</h3>
          <Button onClick={() => handleOpenModal()} className="bg-amber-600 hover:bg-amber-700 text-white">Créer un chantier</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filtered.map((c) => {
            const st = statsMap[c.id] || { expense: 0, income: 0 }
            
            // LOGIQUE FINANCIÈRE RÉPARÉE
            const budgetInit = Number(c.budget_ht || 0)
            const factureReal = st.income
            const expense = st.expense
            
            // La base de calcul : Si on a facturé, c'est la vérité. Sinon, on se base sur le budget.
            const referenceBase = factureReal > 0 ? factureReal : budgetInit
            const margin = referenceBase - expense
            
            // Pourcentage
            const margePct = referenceBase > 0 ? (margin / referenceBase) * 100 : 0
            const consoPct = referenceBase > 0 ? Math.min(100, (expense / referenceBase) * 100) : 0
            const reste = referenceBase - expense

            const cfg = statusConfig[c.status] || statusConfig.en_cours

            return (
              <div key={c.id} className="bg-white p-5 rounded-2xl border shadow-sm space-y-4 group">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-lg text-gray-900 truncate">{c.name}</h3>
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border shrink-0 ${cfg.className}`}>{cfg.label}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-gray-500 font-medium">
                      <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{c.client_name || 'Client N/C'}</span>
                      {(c.city || c.postal_code) && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{c.city} {c.postal_code}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600 hover:bg-blue-50" onClick={() => handleOpenModal(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(c.id, c.name)}><Trash2 className="h-4 w-4" /></Button>
                    <Link href={`/chantiers/${c.id}`}><Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-500 hover:text-amber-600 hover:bg-amber-50"><ExternalLink className="h-4 w-4" /></Button></Link>
                  </div>
                </div>

                {/* NOUVEAU TABLEAU DE RENTABILITÉ LOGIQUE */}
                <div className="bg-gray-50 rounded-xl p-4 border grid grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] uppercase text-gray-500 font-semibold mb-0.5">Budget Initial</p>
                    <p className="font-bold text-gray-600">{formatCurrency(budgetInit)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-blue-600 font-semibold flex items-center gap-1 mb-0.5"><ArrowUpRight className="h-3 w-3"/> Facturé</p>
                    <p className="font-bold text-blue-700">{formatCurrency(factureReal)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-orange-600 font-semibold flex items-center gap-1 mb-0.5"><TrendingDown className="h-3 w-3" /> Dépenses</p>
                    <p className="font-bold text-orange-600">{formatCurrency(expense)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-emerald-600 font-semibold flex items-center gap-1 mb-0.5"><PieChart className="h-3 w-3" /> Marge</p>
                    <div className="flex items-center gap-1.5">
                      <p className={`font-bold ${margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(margin)}</p>
                      {referenceBase > 0 && <span className={`text-[9px] px-1 rounded font-bold ${margePct >= 15 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{margePct.toFixed(0)}%</span>}
                    </div>
                  </div>
                </div>

                {referenceBase > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      <span>Dépenses : {consoPct.toFixed(0)}%</span>
                      <span className={reste < 0 ? 'text-red-600' : ''}>Marge Restante : {formatCurrency(reste)}</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden flex">
                      <div className={`h-full ${consoPct > 90 ? 'bg-red-500' : consoPct > 75 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${consoPct}%` }} />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal identique... */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold flex items-center gap-2"><HardHat className="h-5 w-5 text-amber-600" />{editingId ? 'Modifier le chantier' : 'Nouveau chantier'}</h3>
              <button onClick={() => setShowModal(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto text-sm">
              {modalError && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">{modalError}</div>}
              <div className="space-y-1.5">
                <Label>Nom du chantier *</Label>
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Client</Label>
                  <Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Statut</Label>
                  <Select value={form.status} onValueChange={(v: ChantierStatus) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="brouillon">Brouillon</SelectItem>
                      <SelectItem value="en_cours">En cours</SelectItem>
                      <SelectItem value="termine">Terminé</SelectItem>
                      <SelectItem value="facture">Facturé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Budget HT (€)</Label>
                  <Input type="number" step="0.01" value={form.budget_ht} onChange={(e) => setForm({ ...form, budget_ht: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Début</Label>
                  <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Fin</Label>
                  <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>Annuler</Button>
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