'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Printer, ShieldCheck, Loader2, Send, CheckCircle2, AlertCircle } from 'lucide-react'

interface InvoiceItem {
  description?: string
  designation?: string
  quantity: number
  unitPrice: number
  vatRate: number
  lineHt?: number
}

interface InvoiceDetail {
  id: string
  invoice_number: string
  doc_type: 'facture' | 'devis'
  client_name: string
  client_email: string | null
  client_address: string | null
  issue_date: string
  due_date: string | null
  amount_ht: number
  vat_amount: number
  amount_ttc: number
  is_autoliquidation: boolean
  items: InvoiceItem[]
  notes: string | null
  created_at: string
  chantiers?: { name: string } | null
}

interface OrgDetail {
  name: string
  siret: string | null
  vat_number: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  phone: string | null
  email: string | null
  decennale_company: string | null
  decennale_policy: string | null
  iban: string | null
  bic: string | null
}

function euro(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '0,00 €'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(amount))
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(dateStr))
}

export default function InvoiceDetailPage() {
  const params = useParams()
  const supabase = createClient()
  const invoiceId = params?.id as string

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null)
  const [org, setOrg] = useState<OrgDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)

  const fetchInvoiceData = useCallback(async () => {
    if (!invoiceId) return
    setLoading(true)

    try {
      const { data: invData } = await supabase
        .from('client_invoices')
        .select('*, chantiers(name)')
        .eq('id', invoiceId)
        .maybeSingle()

      if (invData) {
        setInvoice(invData)
      } else {
        const { data: txData } = await supabase
          .from('transactions')
          .select('*, chantiers(name)')
          .eq('id', invoiceId)
          .single()

        if (txData) {
          setInvoice({
            id: txData.id,
            invoice_number: txData.invoice_number || 'FACT-2026-0001',
            doc_type: 'facture',
            client_name: txData.third_party_name || 'Client',
            client_email: null,
            client_address: 'Adresse client',
            issue_date: txData.transaction_date || txData.created_at,
            due_date: null,
            amount_ht: txData.amount_ht || 5000,
            vat_amount: txData.vat_amount || 500,
            amount_ttc: txData.amount_ttc || 5500,
            is_autoliquidation: txData.is_autoliquidation || false,
            items: [
              { designation: 'Prestations & travaux BTP', quantity: 1, unitPrice: txData.amount_ht || 5000, vatRate: 10 }
            ],
            notes: 'Garantie décennale souscrite auprès de notre compagnie d\'assurance.',
            created_at: txData.created_at,
            chantiers: txData.chantiers,
          })
        }
      }

      const { data: orgData } = await supabase.from('organizations').select('*').limit(1).maybeSingle()
      if (orgData) setOrg(orgData)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [invoiceId, supabase])

  useEffect(() => {
    fetchInvoiceData()
  }, [fetchInvoiceData])

  const handleSendInvoiceEmail = async () => {
    if (!invoice) return
    const targetEmail = invoice.client_email || window.prompt("Saisissez l'adresse e-mail du client :")
    if (!targetEmail || !targetEmail.includes('@')) {
      alert("Adresse e-mail valide requise pour l'envoi.")
      return
    }

    setSendingEmail(true)
    setEmailError(null)
    setEmailSuccess(null)

    try {
      const currentUrl = typeof window !== 'undefined' ? window.location.href : ''
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'invoice',
          to: targetEmail.trim(),
          invoiceNumber: invoice.invoice_number,
          clientName: invoice.client_name,
          amountTtc: invoice.amount_ttc,
          invoiceUrl: currentUrl,
          companyName: org?.name || 'Votre entreprise BTP',
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'envoi de l'e-mail")

      setEmailSuccess(`Facture N° ${invoice.invoice_number} envoyée avec succès par e-mail à ${targetEmail} !`)
    } catch (err: unknown) {
      setEmailError(err instanceof Error ? err.message : 'Erreur lors de l\'envoi')
    } finally {
      setSendingEmail(false)
    }
  }

  if (loading) {
    return (
      <div className="p-16 text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600 mx-auto" />
        <p className="text-sm text-gray-500 font-medium">Génération de la facture...</p>
      </div>
    )
  }

  const isDevis = invoice?.doc_type === 'devis'

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/factures">
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Retour aux factures
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleSendInvoiceEmail}
            disabled={sendingEmail}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold shadow-md"
          >
            {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Envoyer au client
          </Button>

          <Button onClick={() => window.print()} className="bg-amber-600 hover:bg-amber-700 text-white gap-2 font-bold shadow-md">
            <Printer className="h-4 w-4" /> Imprimer / PDF
          </Button>
        </div>
      </div>

      {emailError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2 print:hidden">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{emailError}</span>
        </div>
      )}

      {emailSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2 font-medium print:hidden">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <span>{emailSuccess}</span>
        </div>
      )}

      <div className="bg-white p-8 sm:p-12 rounded-2xl border border-gray-200 shadow-lg space-y-8 print:shadow-none print:border-none print:p-0">
        <div className="flex flex-col sm:flex-row justify-between gap-6 border-b pb-6">
          <div className="space-y-1 text-sm">
            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">{org?.name || 'PLOMBIER DU VILLAGE SARL'}</h2>
            <p className="text-gray-600">{org?.address || '12 rue des Artisans'}</p>
            <p className="text-gray-600">{org?.postal_code || '69000'} {org?.city || 'LYON'}</p>
            <p className="text-gray-500 text-xs font-mono mt-2">SIRET : {org?.siret || '123 456 789 00012'}</p>
            {org?.vat_number && <p className="text-gray-500 text-xs font-mono">TVA : {org.vat_number}</p>}
            <p className="text-gray-500 text-xs">Tél : {org?.phone || '06 12 34 56 78'}</p>
          </div>

          <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 text-sm space-y-1 min-w-[260px]">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">FACTURÉ À :</p>
            <p className="font-bold text-gray-900 text-base">{invoice?.client_name || 'M. Dupont Marc'}</p>
            <p className="text-gray-600">{invoice?.client_address || '14 Rue du Moulin, 69000 Lyon'}</p>
            {invoice?.client_email && <p className="text-gray-500 text-xs">{invoice.client_email}</p>}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between gap-4 bg-amber-50/50 p-4 rounded-xl border border-amber-100">
          <div>
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">{isDevis ? 'DEVIS N°' : 'FACTURE N°'}</span>
            <p className="text-2xl font-black font-mono text-gray-900">{invoice?.invoice_number || 'FACT-2026-0001'}</p>
            {invoice?.chantiers?.name && (
              <p className="text-xs text-amber-900 font-semibold mt-1">Chantier : {invoice.chantiers.name}</p>
            )}
          </div>
          <div className="text-right text-xs space-y-1 text-gray-600">
            <p>Date d'émission : <strong>{formatDate(invoice?.issue_date)}</strong></p>
            <p>Date d'échéance : <strong>{formatDate(invoice?.due_date || invoice?.issue_date)}</strong></p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-100 border-y border-gray-200 text-xs uppercase font-bold text-gray-700">
              <tr>
                <th className="px-4 py-3">Désignation des travaux & fournitures</th>
                <th className="px-4 py-3 text-center">Qté</th>
                <th className="px-4 py-3 text-right">P.U. HT</th>
                <th className="px-4 py-3 text-center">TVA</th>
                <th className="px-4 py-3 text-right">Total HT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(invoice?.items || []).map((item, idx) => {
                const label = item.description || item.designation || 'Prestation BTP'
                const qte = item.quantity || 1
                const pu = item.unitPrice || 0
                const ht = item.lineHt || qte * pu

                return (
                  <tr key={idx} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3.5 font-medium text-gray-900">{label}</td>
                    <td className="px-4 py-3.5 text-center font-mono">{qte}</td>
                    <td className="px-4 py-3.5 text-right font-mono">{euro(pu)}</td>
                    <td className="px-4 py-3.5 text-center font-bold text-xs">{invoice?.is_autoliquidation ? '0%' : `${item.vatRate}%`}</td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-gray-900">{euro(ht)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row justify-between gap-6 pt-4 border-t border-gray-200">
          <div className="space-y-3 max-w-md text-xs text-gray-500">
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-1">
              <p className="font-bold text-gray-700 flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-blue-600"/> Garantie Décennale BTP</p>
              <p>{org?.decennale_company || 'AXA Assurances'} — Police N° {org?.decennale_policy || 'POL-2026-987654'}</p>
            </div>

            {org?.iban && (
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-1">
                <p className="font-bold text-gray-700">Règlement par virement bancaire :</p>
                <p className="font-mono text-gray-900 font-bold">IBAN : {org.iban}</p>
                {org.bic && <p className="font-mono text-gray-500">BIC : {org.bic}</p>}
              </div>
            )}

            {invoice?.is_autoliquidation && (
              <p className="font-bold text-blue-700 bg-blue-50 p-2.5 rounded-lg border border-blue-200">
                Mention légale : Autoliquidation de la TVA - Article 283-2 nonies du CGI (Sous-traitance BTP).
              </p>
            )}

            {invoice?.notes && <p className="italic text-gray-600">{invoice.notes}</p>}
          </div>

          <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 space-y-2 text-sm min-w-[260px] self-start">
            <div className="flex justify-between text-gray-600">
              <span>Total HT :</span>
              <span className="font-mono font-bold text-gray-900">{euro(invoice?.amount_ht)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Total TVA :</span>
              <span className="font-mono font-bold text-gray-900">{euro(invoice?.vat_amount)}</span>
            </div>
            <div className="flex justify-between text-lg font-black text-amber-700 border-t border-gray-200 pt-2 mt-2">
              <span>Total TTC :</span>
              <span className="font-mono">{euro(invoice?.amount_ttc)}</span>
            </div>
          </div>
        </div>

        <div className="text-center text-[10px] text-gray-400 border-t pt-4 space-y-1">
          <p>En cas de retard de paiement, indemnité forfaitaire pour frais de recouvrement : 40 €. Taux d'intérêt de retard : 10 % l'an.</p>
          <p>Document édité via Paperasse.ai — Pré-comptabilité & Facturation BTP</p>
        </div>
      </div>
    </div>
  )
}