'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
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
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  FileText,
  RefreshCw,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────
type TransactionType = 'expense' | 'income' | 'receipt' | 'other'
type PaymentStatus = 'paid' | 'unpaid' | 'unknown'
type ValidationStatus = 'pending' | 'validated' | 'ignored'

interface TransactionItem {
  id: string
  organization_id: string
  document_id: string | null
  transaction_type: TransactionType
  third_party_name: string | null
  category: string | null
  invoice_number: string | null
  transaction_date: string | null
  amount_ht: number
  vat_amount: number
  amount_ttc: number
  payment_status: PaymentStatus
  validation_status: ValidationStatus
  created_at: string
}

// ─── Config UI ───────────────────────────────────────────────
const typeConfig: Record<
  TransactionType,
  { label: string; className: string; icon: 'in' | 'out' | 'receipt' | 'other' }
> = {
  income: {
    label: 'Recette',
    className: 'bg-green-50 text-green-700 border border-green-200',
    icon: 'in',
  },
  expense: {
    label: 'Dépense',
    className: 'bg-orange-50 text-orange-700 border border-orange-200',
    icon: 'out',
  },
  receipt: {
    label: 'Ticket',
    className: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
    icon: 'receipt',
  },
  other: {
    label: 'Autre',
    className: 'bg-gray-100 text-gray-700 border border-gray-200',
    icon: 'other',
  },
}

const paymentConfig: Record<PaymentStatus, { label: string; className: string }> = {
  paid: {
    label: 'Payé',
    className: 'bg-green-50 text-green-700 border border-green-200',
  },
  unpaid: {
    label: 'Impayé',
    className: 'bg-red-50 text-red-700 border border-red-200',
  },
  unknown: {
    label: 'Inconnu',
    className: 'bg-gray-100 text-gray-600 border border-gray-200',
  },
}

const validationConfig: Record<
  ValidationStatus,
  { label: string; className: string }
> = {
  validated: {
    label: 'Validée',
    className: 'bg-green-50 text-green-700 border border-green-200',
  },
  pending: {
    label: 'En attente',
    className: 'bg-amber-50 text-amber-700 border border-amber-200',
  },
  ignored: {
    label: 'Ignorée',
    className: 'bg-gray-100 text-gray-600 border border-gray-200',
  },
}

// ─── Helpers ─────────────────────────────────────────────────
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

function TypeIcon({ type }: { type: TransactionType }) {
  if (type === 'income') {
    return <ArrowUpRight className="h-4 w-4 text-green-600" />
  }
  if (type === 'expense') {
    return <ArrowDownRight className="h-4 w-4 text-orange-600" />
  }
  if (type === 'receipt') {
    return <Receipt className="h-4 w-4 text-yellow-600" />
  }
  return <FileText className="h-4 w-4 text-gray-500" />
}

// ─── Stats ───────────────────────────────────────────────────
function StatsBar({ items }: { items: TransactionItem[] }) {
  const income = items
    .filter((t) => t.transaction_type === 'income')
    .reduce((sum, t) => sum + Number(t.amount_ttc || 0), 0)

  const expense = items
    .filter((t) => t.transaction_type === 'expense' || t.transaction_type === 'receipt')
    .reduce((sum, t) => sum + Number(t.amount_ttc || 0), 0)

  const unpaid = items
    .filter((t) => t.payment_status === 'unpaid')
    .reduce((sum, t) => sum + Number(t.amount_ttc || 0), 0)

  const pending = items.filter((t) => t.validation_status === 'pending').length

  const stats = [
    {
      label: 'Recettes',
      value: formatCurrency(income),
      color: 'text-green-600',
    },
    {
      label: 'Dépenses',
      value: formatCurrency(expense),
      color: 'text-orange-600',
    },
    {
      label: 'Solde',
      value: formatCurrency(income - expense),
      color: income - expense >= 0 ? 'text-blue-600' : 'text-red-600',
    },
    {
      label: 'Impayés',
      value: formatCurrency(unpaid),
      color: 'text-red-600',
    },
    {
      label: 'À valider',
      value: String(pending),
      color: 'text-amber-600',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm"
        >
          <p className="text-sm text-gray-500">{stat.label}</p>
          <p className={`text-xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────
export default function TransactionsPage() {
  const { user } = useAuth()
  const supabase = createClient()

  const [items, setItems] = useState<TransactionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [paymentFilter, setPaymentFilter] = useState<string>('all')
  const [validationFilter, setValidationFilter] = useState<string>('all')

  const fetchTransactions = useCallback(async () => {
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
        setLoading(false)
        return
      }

      const { data, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('transaction_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })

      if (txError) throw txError

      setItems((data as TransactionItem[]) || [])
    } catch (err: unknown) {
      console.error('Erreur chargement transactions:', err)
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de charger les transactions'
      )
    } finally {
      setLoading(false)
    }
  }, [user, supabase])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  const filtered = useMemo(() => {
    return items.filter((t) => {
      const q = search.toLowerCase().trim()

      const matchesSearch =
        q === '' ||
        t.third_party_name?.toLowerCase().includes(q) ||
        t.invoice_number?.toLowerCase().includes(q) ||
        t.category?.toLowerCase().includes(q)

      const matchesType =
        typeFilter === 'all' || t.transaction_type === typeFilter

      const matchesPayment =
        paymentFilter === 'all' || t.payment_status === paymentFilter

      const matchesValidation =
        validationFilter === 'all' || t.validation_status === validationFilter

      return matchesSearch && matchesType && matchesPayment && matchesValidation
    })
  }, [items, search, typeFilter, paymentFilter, validationFilter])

  async function updateValidation(id: string, status: ValidationStatus) {
    try {
      const { error: updateError } = await supabase
        .from('transactions')
        .update({ validation_status: status })
        .eq('id', id)

      if (updateError) throw updateError

      setItems((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, validation_status: status } : t
        )
      )
    } catch (err) {
      console.error(err)
      alert('Impossible de mettre à jour le statut')
    }
  }

  async function updatePayment(id: string, status: PaymentStatus) {
    try {
      const { error: updateError } = await supabase
        .from('transactions')
        .update({ payment_status: status })
        .eq('id', id)

      if (updateError) throw updateError

      setItems((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, payment_status: status } : t
        )
      )
    } catch (err) {
      console.error(err)
      alert('Impossible de mettre à jour le paiement')
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
            Transactions
          </h1>
          <p className="text-gray-500 mt-1">
            Suivi de vos recettes, dépenses et impayés
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={fetchTransactions}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Link href="/documents">
            <Button variant="outline" className="gap-2">
              <FileText className="h-4 w-4" />
              Voir les documents
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      {!loading && items.length > 0 && <StatsBar items={items} />}

      {/* Filtres */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Rechercher un tiers, n° facture, catégorie…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full lg:w-[170px]">
              <Filter className="h-4 w-4 mr-2 text-gray-400" />
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              <SelectItem value="income">Recettes</SelectItem>
              <SelectItem value="expense">Dépenses</SelectItem>
              <SelectItem value="receipt">Tickets</SelectItem>
              <SelectItem value="other">Autres</SelectItem>
            </SelectContent>
          </Select>

          <Select value={paymentFilter} onValueChange={setPaymentFilter}>
            <SelectTrigger className="w-full lg:w-[170px]">
              <SelectValue placeholder="Paiement" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous paiements</SelectItem>
              <SelectItem value="paid">Payé</SelectItem>
              <SelectItem value="unpaid">Impayé</SelectItem>
              <SelectItem value="unknown">Inconnu</SelectItem>
            </SelectContent>
          </Select>

          <Select value={validationFilter} onValueChange={setValidationFilter}>
            <SelectTrigger className="w-full lg:w-[170px]">
              <SelectValue placeholder="Validation" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              <SelectItem value="validated">Validées</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="ignored">Ignorées</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Contenu */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-3 text-gray-500">
              Chargement des transactions…
            </span>
          </div>
        )}

        {!loading && error && (
          <div className="p-8 text-center">
            <div className="bg-red-50 text-red-600 text-sm p-4 rounded-lg inline-block mb-4">
              {error}
            </div>
            <div>
              <Button variant="outline" onClick={fetchTransactions}>
                Réessayer
              </Button>
            </div>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Receipt className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Aucune transaction pour le moment
            </h3>
            <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
              Uploadez un document, vérifiez les données extraites, puis cliquez
              sur <strong>Valider & créer la transaction</strong>.
            </p>
            <Link href="/documents">
              <Button className="gap-2">
                <FileText className="h-4 w-4" />
                Aller aux documents
              </Button>
            </Link>
          </div>
        )}

        {!loading &&
          !error &&
          items.length > 0 &&
          filtered.length === 0 && (
            <div className="p-12 text-center">
              <p className="text-gray-500 mb-4">
                Aucune transaction ne correspond à vos filtres.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('')
                  setTypeFilter('all')
                  setPaymentFilter('all')
                  setValidationFilter('all')
                }}
              >
                Réinitialiser les filtres
              </Button>
            </div>
          )}

        {!loading && !error && filtered.length > 0 && (
          <>
            {/* Header desktop */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div className="col-span-3">Tiers</div>
              <div className="col-span-2">Type</div>
              <div className="col-span-2">Montant TTC</div>
              <div className="col-span-2">Date</div>
              <div className="col-span-1">Paiement</div>
              <div className="col-span-2">Validation</div>
            </div>

            <div className="divide-y divide-gray-50">
              {filtered.map((t) => {
                const type = typeConfig[t.transaction_type] || typeConfig.other
                const payment = paymentConfig[t.payment_status] || paymentConfig.unknown
                const validation =
                  validationConfig[t.validation_status] || validationConfig.pending

                const isIncome = t.transaction_type === 'income'

                return (
                  <div
                    key={t.id}
                    className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 px-6 py-4 hover:bg-gray-50/80 transition-colors items-center"
                  >
                    {/* Tiers */}
                    <div className="md:col-span-3 min-w-0">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <TypeIcon type={t.transaction_type} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {t.third_party_name || 'Tiers non renseigné'}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {t.category || 'Sans catégorie'}
                            {t.invoice_number ? ` · N° ${t.invoice_number}` : ''}
                          </p>
                          {t.document_id && (
                            <Link
                              href={`/documents/${t.document_id}`}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Voir le document
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Type */}
                    <div className="md:col-span-2">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-medium ${type.className}`}
                      >
                        {type.label}
                      </span>
                    </div>

                    {/* Montant */}
                    <div className="md:col-span-2">
                      <p
                        className={`text-sm font-semibold ${
                          isIncome ? 'text-green-600' : 'text-gray-900'
                        }`}
                      >
                        {isIncome ? '+' : '-'}
                        {formatCurrency(Math.abs(Number(t.amount_ttc || 0)))}
                      </p>
                      <p className="text-xs text-gray-400">
                        HT {formatCurrency(t.amount_ht)} · TVA{' '}
                        {formatCurrency(t.vat_amount)}
                      </p>
                    </div>

                    {/* Date */}
                    <div className="md:col-span-2">
                      <span className="text-sm text-gray-600">
                        {formatDate(t.transaction_date || t.created_at)}
                      </span>
                    </div>

                    {/* Paiement */}
                    <div className="md:col-span-1">
                      <Select
                        value={t.payment_status}
                        onValueChange={(v) =>
                          updatePayment(t.id, v as PaymentStatus)
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="paid">Payé</SelectItem>
                          <SelectItem value="unpaid">Impayé</SelectItem>
                          <SelectItem value="unknown">Inconnu</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Validation */}
                    <div className="md:col-span-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-[11px] font-medium ${validation.className}`}
                        >
                          {validation.label}
                        </span>
                        {t.validation_status !== 'validated' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => updateValidation(t.id, 'validated')}
                          >
                            Valider
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="px-6 py-3 bg-gray-50/50 border-t border-gray-100 text-sm text-gray-500">
              {filtered.length} transaction{filtered.length > 1 ? 's' : ''}
              {filtered.length !== items.length && ` sur ${items.length}`}
            </div>
          </>
        )}
      </div>
    </div>
  )
}