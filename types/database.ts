export type Organization = {
  id: string
  name: string
  legal_form: string | null
  industry: string | null
  siret: string | null
  siren: string | null
  vat_number: string | null
  vat_regime: 'standard' | 'franchise' | null
  accountant_email: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  country: string | null
  created_by: string | null
  created_at: string
  updated_at: string | null
}

export type Profile = {
  id: string
  organization_id: string | null
  email: string
  full_name: string | null
  role: 'owner' | 'admin' | 'member'
  created_at: string
  updated_at: string | null
}

export type Chantier = {
  id: string
  organization_id: string
  name: string
  client_id: string | null
  status: 'active' | 'completed' | 'paused'
  budget: number | null
  created_at: string
}

export type VatRateDetail = {
  rate: number          // e.g., 20, 10, 5.5, 2.1
  base_ht: number       // Base de calcul HT pour ce taux
  vat_amount: number    // Montant de la TVA pour ce taux
}

export type ExtractedData = {
  document_type: 'supplier_invoice' | 'customer_invoice' | 'receipt' | 'quote' | 'other'
  third_party_name: string | null
  invoice_number: string | null
  transaction_date: string | null
  amount_ht: number | null
  amount_ttc: number | null
  vat_amount: number | null
  vat_rates: VatRateDetail[]  // <-- Gestion des taux de TVA multiples
  is_autoliquidation: boolean // <-- Spécificité BTP
  payment_method: 'cb' | 'cash' | 'transfer' | 'cheque' | 'unknown'
  category: string | null
  chantier_hint: string | null // Nom du chantier détecté sur la facture
  confidence_score: number
  needs_review: boolean
  raw_notes: string | null
}

export type Document = {
  id: string
  organization_id: string
  user_id: string | null
  file_url: string
  file_name: string
  file_type: string | null
  status: 'uploaded' | 'analyzing' | 'analyzed' | 'validated' | 'error'
  document_type: string | null
  extracted_data: ExtractedData | null
  confidence_score: number | null
  chantier_id: string | null // <-- Liaison Chantier
  created_at: string
}

export type Transaction = {
  id: string
  organization_id: string
  document_id: string | null
  chantier_id: string | null // <-- Liaison Chantier pour calcul de marge
  transaction_type: 'expense' | 'income' | 'receipt' | 'other'
  third_party_name: string | null
  category: string | null
  invoice_number: string | null
  transaction_date: string | null
  amount_ht: number
  vat_amount: number
  amount_ttc: number
  vat_rates: VatRateDetail[] | null
  is_autoliquidation: boolean
  payment_method: string | null
  payment_status: 'paid' | 'unpaid' | 'unknown'
  validation_status: 'pending' | 'validated' | 'ignored'
  created_at: string
}

export type Subscription = {
  id: string
  organization_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  plan: 'free' | 'starter' | 'pro' | 'business'
  status: 'active' | 'inactive' | 'canceled' | 'past_due'
  current_period_end: string | null
  created_at: string
}
