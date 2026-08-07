'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Loader2,
  Plus,
  Search,
  MapPin,
  Calendar,
  HardHat,
  X,
  Pencil,
  Trash2,
  RefreshCw,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────
type ChantierStatus = 'brouillon' | 'en_cours' | 'termine' | 'facture' | 'archive'

interface Chantier {
  id: string
  organization_id: string
  name: string
  client_name: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  status: ChantierStatus
  start_date: string | null
  end_date: string | null
  budget_ht: number | null
  notes: string | null
  created_at: string
}

interface ChantierForm {
  name: string
  client_name: string
  address: string
  city: string
  postal_code: string
  status: ChantierStatus
  start_date: string
  end_date: string
  budget_ht: string
  notes: string
}

const EMPTY_FORM: ChantierForm = {
  name: '',
  client_name: '',
  address: '',
  city: '',
  postal_code: '',
  status: 'en_cours',
  start_date: '',
  end_date: '',
  budget_ht: '',
  notes: '',
}

// ─── Config ──────────────────────────────────────────────────
const statusConfig: Record<
  ChantierStatus,
  { label: string; className: string }
> = {
  brouillon: {
    label: 'Brouillon',
    className: 'bg-gray-100 text-gray-700 border border-gray-200',
  },
  en_cours: {
    label: 'En cours',
    className: 'bg-blue-50 text-blue-700 border border-blue-200',
  },
  termine: {
    label: 'Terminé',
    className: 'bg-green-50 text-green-700 border border-green-200',
  },
  facture: {
    label: 'Facturé',
    className: 'bg-purple-50 text-purple-700 border border-purple-200',
  },
  archive: {
    label: 'Archivé',
    className: 'bg-gray-100 text-gray-500 border border-gray-200',
  },
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) {
    return '—'
  }
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(amount))
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateString))
}

// ─── Page ────────────────────────────────────────────────────
export default function ChantiersPage() {
  const { user } = useAuth()
  const supabase = createClient()

  const [items, setItems] = useState<Chantier[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ChantierForm>(EMPTY_FORM)
  const [organizationId, setOrganizationId] = useState<string | null>(null)

  const fetchChantiers = useCallback(async () => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      if (profileError) throw profileError

      if (!profile?.organization_id) {
        setItems([])
        setOrganizationId(null)
        setLoading(false)
        return
      }

      setOrganizationId(profile.organization_id)

      const { data, error: chantiersError } = await supabase
        .from('chantiers')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false })

      if (chantiersError) throw chantiersError

      setItems((data as Chantier[]) || [])
    } catch (err: unknown) {
      console.error(err)
      setError(
        err instanceof Error ? err.message : 'Impossible de charger les chantiers'
      )
    } finally {
      setLoading(false)
    }
  }, [user, supabase])

  useEffect(() => {
    fetchChantiers()
  }, [fetchChantiers])

  const filtered = useMemo(() => {
    return items.filter((c) => {
      const q = search.toLowerCase().trim()
      const matchesSearch =
        q === '' ||
        c.name.toLowerCase().includes(q) ||
        c.client_name?.toLowerCase().includes(q) ||
        c.city?.toLowerCase().includes(q) ||
        c.address?.toLowerCase().includes(q)

      const matchesStatus =
        statusFilter === 'all' || c.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [items, search, statusFilter])

  const stats = useMemo(() => {
    return {
      total: items.length,
      enCours: items.filter((c) => c.status === 'en_cours').length,
      termines: items.filter((c) => c.status === 'termine' || c.status === 'facture').length,
      budget: items.reduce((sum, c) => sum + Number(c.budget_ht || 0), 0),
    }
  }, [items])

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
    setError(null)
  }

  function openEdit(chantier: Chantier) {
    setEditingId(chantier.id)
    setForm({
      name: chantier.name || '',
      client_name: chantier.client_name || '',
      address: chantier.address || '',
      city: chantier.city || '',
      postal_code: chantier.postal_code || '',
      status: chantier.status || 'en_cours',
      start_date: chantier.start_date || '',
      end_date: chantier.end_date || '',
      budget_ht:
        chantier.budget_ht !== null && chantier.budget_ht !== undefined
          ? String(chantier.budget_ht)
          : '',
      notes: chantier.notes || '',
    })
    setShowForm(true)
    setError(null)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!organizationId) {
      setError('Aucune entreprise associée à votre compte')
      return
    }
    if (!form.name.trim()) {
      setError('Le nom du chantier est obligatoire')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const payload = {
        organization_id: organizationId,
        name: form.name.trim(),
        client_name: form.client_name.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        postal_code: form.postal_code.trim() || null,
        status: form.status,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        budget_ht: form.budget_ht
          ? parseFloat(form.budget_ht.replace(',', '.'))
          : 0,
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      }

      if (editingId) {
        const { error: updateError } = await supabase
          .from('chantiers')
          .update(payload)
          .eq('id', editingId)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('chantiers')
          .insert(payload)

        if (insertError) throw insertError
      }

      closeForm()
      await fetchChantiers()
    } catch (err: unknown) {
      console.error(err)
      setError(
        err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement'
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    const ok = window.confirm('Supprimer ce chantier ?')
    if (!ok) return

    try {
      const { error: deleteError } = await supabase
        .from('chantiers')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError
      await fetchChantiers()
    } catch (err: unknown) {
      console.error(err)
      alert(
        err instanceof Error ? err.message : 'Suppression impossible'
      )
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
            Chantiers
          </h1>
          <p className="text-gray-500 mt-1">
            Organisez vos travaux par chantier et par client
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={fetchChantiers}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button className="gap-2" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nouveau chantier
          </Button>
        </div>
      </div>

      {/* Stats */}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-sm text-gray-500">En cours</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{stats.enCours}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-sm text-gray-500">Terminés / Facturés</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{stats.termines}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-sm text-gray-500">Budget total HT</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatCurrency(stats.budget)}
            </p>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Rechercher un chantier, client, ville…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="brouillon">Brouillon</SelectItem>
              <SelectItem value="en_cours">En cours</SelectItem>
              <SelectItem value="termine">Terminé</SelectItem>
              <SelectItem value="facture">Facturé</SelectItem>
              <SelectItem value="archive">Archivé</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Erreur globale */}
      {error && !showForm && (
        <div className="mb-4 bg-red-50 text-red-600 text-sm p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* Liste */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-3 text-gray-500">Chargement des chantiers…</span>
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <HardHat className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Aucun chantier pour le moment
            </h3>
            <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
              Créez votre premier chantier pour classer vos documents et
              suivre la rentabilité par client.
            </p>
            <Button className="gap-2" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Créer mon premier chantier
            </Button>
          </div>
        )}

        {!loading && items.length > 0 && filtered.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-gray-500 mb-4">
              Aucun chantier ne correspond à vos filtres.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setSearch('')
                setStatusFilter('all')
              }}
            >
              Réinitialiser les filtres
            </Button>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="divide-y divide-gray-50">
            {filtered.map((c) => {
              const status = statusConfig[c.status] || statusConfig.en_cours

              return (
                <div
                  key={c.id}
                  className="p-5 hover:bg-gray-50/80 transition-colors"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 flex-wrap mb-1">
                        <h3 className="text-base font-semibold text-gray-900">
                          {c.name}
                        </h3>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </div>

                      <p className="text-sm text-gray-600">
                        {c.client_name || 'Client non renseigné'}
                      </p>

                      <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
                        {(c.address || c.city) && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {[c.address, c.postal_code, c.city]
                              .filter(Boolean)
                              .join(', ')}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(c.start_date)} → {formatDate(c.end_date)}
                        </span>
                        <span className="font-medium text-gray-700">
                          Budget : {formatCurrency(c.budget_ht)}
                        </span>
                      </div>

                      {c.notes && (
                        <p className="text-xs text-gray-400 mt-2 line-clamp-2">
                          {c.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => openEdit(c)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Modifier
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDelete(c.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Supprimer
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="px-6 py-3 bg-gray-50/50 border-t border-gray-100 text-sm text-gray-500">
            {filtered.length} chantier{filtered.length > 1 ? 's' : ''}
            {filtered.length !== items.length && ` sur ${items.length}`}
          </div>
        )}
      </div>

      {/* Modal formulaire */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeForm}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId ? 'Modifier le chantier' : 'Nouveau chantier'}
              </h2>
              <button
                onClick={closeForm}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">
                  Nom du chantier <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="ex: Rénovation Dupont - Villeurbanne"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="client_name">Client</Label>
                <Input
                  id="client_name"
                  value={form.client_name}
                  onChange={(e) =>
                    setForm({ ...form, client_name: e.target.value })
                  }
                  placeholder="ex: M. Dupont Jean"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Adresse</Label>
                <Input
                  id="address"
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                  placeholder="ex: 45 avenue de la République"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="postal_code">Code postal</Label>
                  <Input
                    id="postal_code"
                    value={form.postal_code}
                    onChange={(e) =>
                      setForm({ ...form, postal_code: e.target.value })
                    }
                    placeholder="69100"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Ville</Label>
                  <Input
                    id="city"
                    value={form.city}
                    onChange={(e) =>
                      setForm({ ...form, city: e.target.value })
                    }
                    placeholder="Villeurbanne"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Statut</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm({ ...form, status: v as ChantierStatus })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brouillon">Brouillon</SelectItem>
                    <SelectItem value="en_cours">En cours</SelectItem>
                    <SelectItem value="termine">Terminé</SelectItem>
                    <SelectItem value="facture">Facturé</SelectItem>
                    <SelectItem value="archive">Archivé</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Date de début</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={form.start_date}
                    onChange={(e) =>
                      setForm({ ...form, start_date: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">Date de fin</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={form.end_date}
                    onChange={(e) =>
                      setForm({ ...form, end_date: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="budget_ht">Budget HT (€)</Label>
                <Input
                  id="budget_ht"
                  inputMode="decimal"
                  value={form.budget_ht}
                  onChange={(e) =>
                    setForm({ ...form, budget_ht: e.target.value })
                  }
                  placeholder="1850.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) =>
                    setForm({ ...form, notes: e.target.value })
                  }
                  placeholder="Infos utiles sur le chantier…"
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Annuler
                </Button>
                <Button type="submit" className="flex-1 gap-2" disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingId ? 'Enregistrer' : 'Créer le chantier'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}