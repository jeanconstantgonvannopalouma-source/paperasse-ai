'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Loader2, Plus, Search, Users, X, Pencil, Trash2, RefreshCw,
  Mail, Phone, MapPin, Building2, UserCheck, Briefcase, AlertCircle
} from 'lucide-react'

interface ClientData {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  siret: string | null
  client_type: 'particulier' | 'pro' | null
  notes: string | null
}

const EMPTY_FORM = {
  name: '', email: '', phone: '', address: '', city: '', postal_code: '', siret: '',
  client_type: 'particulier' as 'particulier' | 'pro', notes: ''
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientData[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modalError, setModalError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'pro' | 'particulier'>('all')

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const fetchClients = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/clients')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur lors du chargement des clients')
      setClients(data.clients || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
      setClients([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchClients() }, [fetchClients])

  const openModal = (c?: ClientData) => {
    setModalError(null)
    if (c) {
      setEditingId(c.id)
      setForm({
        name: c.name, email: c.email || '', phone: c.phone || '', address: c.address || '',
        city: c.city || '', postal_code: c.postal_code || '', siret: c.siret || '',
        client_type: c.client_type || (c.siret ? 'pro' : 'particulier'), notes: c.notes || ''
      })
    } else {
      setEditingId(null)
      setForm(EMPTY_FORM)
    }
    setShowForm(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setModalError('Nom du client obligatoire')
      return
    }
    setSaving(true)
    setModalError(null)

    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, ...form }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la sauvegarde')

      setShowForm(false)
      await fetchClients()
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Erreur sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Supprimer définitivement le client "${name}" ?`)) return
    try {
      const res = await fetch(`/api/clients?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur suppression')
      await fetchClients()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erreur suppression')
    }
  }

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase()
    const isPro = !!c.siret || c.client_type === 'pro'
    const okType = typeFilter === 'all' || (typeFilter === 'pro' && isPro) || (typeFilter === 'particulier' && !isPro)
    const okSearch = !q || (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q) || (c.siret || '').toLowerCase().includes(q)
    return okType && okSearch
  })

  const proCount = clients.filter(c => !!c.siret || c.client_type === 'pro').length

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">Carnet Clients</h1>
          <p className="text-sm text-gray-500 mt-1">Gérez vos clients particuliers et professionnels (B2C / B2B).</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={fetchClients} disabled={loading} className="gap-2 text-gray-500 hover:text-gray-900">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-amber-600' : ''}`} /> Actualiser
          </Button>
          <Button onClick={() => openModal()} className="bg-amber-600 hover:bg-amber-700 text-white gap-2 font-medium">
            <Plus className="h-4 w-4" /> Nouveau client
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border p-5 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Clients</p>
          <p className="text-3xl font-black mt-1">{clients.length}</p>
        </div>
        <div className="bg-white rounded-2xl border p-5 shadow-sm border-blue-200/60 bg-blue-50/10">
          <p className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5" /> Entreprises (Pro)</p>
          <p className="text-3xl font-black text-blue-700 mt-1">{proCount}</p>
        </div>
        <div className="bg-white rounded-2xl border p-5 shadow-sm border-emerald-200/60 bg-emerald-50/10">
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5"><UserCheck className="h-3.5 w-3.5" /> Particuliers</p>
          <p className="text-3xl font-black text-emerald-700 mt-1">{clients.length - proCount}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-4 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Rechercher (nom, email, SIRET...)" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={(val: 'all' | 'pro' | 'particulier') => setTypeFilter(val)}>
          <SelectTrigger className="w-full sm:w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les clients</SelectItem>
            <SelectItem value="particulier">Particuliers</SelectItem>
            <SelectItem value="pro">Professionnels</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="bg-white p-16 rounded-2xl border text-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600 mx-auto" />
        </div>
      ) : clients.length === 0 ? (
        <div className="bg-white p-16 rounded-2xl border text-center space-y-4">
          <Users className="h-10 w-10 text-amber-600 mx-auto" />
          <h3 className="text-lg font-bold">Aucun client trouvé</h3>
          <p className="text-sm text-gray-500">Ajoutez vos clients pour éditer des devis ou factures.</p>
          <Button onClick={() => openModal()} className="bg-amber-600 hover:bg-amber-700 text-white mt-2">Créer un client</Button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border shadow-sm divide-y">
          {filtered.map((c) => {
            const isPro = !!c.siret || c.client_type === 'pro'
            return (
              <div key={c.id} className="p-5 hover:bg-gray-50/50 group flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <h3 className="font-bold text-gray-900 text-base">{c.name}</h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${isPro ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                      {isPro ? 'Pro' : 'Particulier'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-gray-500 font-medium">
                    {c.email && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{c.email}</span>}
                    {c.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{c.phone}</span>}
                    {(c.city || c.address) && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{[c.address, c.postal_code, c.city].filter(Boolean).join(', ')}</span>}
                  </div>
                  {c.siret && <p className="text-[11px] font-mono text-gray-400 pt-1">SIRET : {c.siret}</p>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openModal(c)} className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50"><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id, c.name)} className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b flex justify-between bg-gray-50">
              <h3 className="font-bold flex items-center gap-2"><Building2 className="h-5 w-5 text-amber-600" />{editingId ? 'Modifier le client' : 'Nouveau client'}</h3>
              <button onClick={() => setShowForm(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto text-sm">
              {modalError && <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs">{modalError}</div>}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={form.client_type} onValueChange={(v: 'particulier' | 'pro') => setForm({ ...form, client_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="particulier">Particulier</SelectItem>
                      <SelectItem value="pro">Pro (B2B)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>SIRET {form.client_type === 'pro' && <span className="text-amber-600">*</span>}</Label>
                  <Input value={form.siret} onChange={(e) => setForm({ ...form, siret: e.target.value })} className="font-mono" placeholder="123 456 789 00012" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Nom / Raison sociale *</Label>
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ex: M. Dupont Marc" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="client@email.fr" /></div>
                <div className="space-y-1.5"><Label>Téléphone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="06 12 34 56 78" /></div>
              </div>

              <div className="space-y-1.5"><Label>Adresse</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="ex: 14 Rue du Moulin" /></div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Code Postal</Label><Input value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} placeholder="69000" /></div>
                <div className="space-y-1.5"><Label>Ville</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Lyon" /></div>
              </div>

              <div className="flex justify-end pt-2 border-t mt-4 gap-2">
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Annuler</Button>
                <Button type="submit" disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-white min-w-[120px]">
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