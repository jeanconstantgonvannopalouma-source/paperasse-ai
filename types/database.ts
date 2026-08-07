// ======================================================
// Types mis à jour pour utiliser "organizations" au lieu de "companies"
// ======================================================

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
  organization_id: string | null          // ← Corrigé
  email: string
  full_name: string | null
  role: 'owner' | 'admin' | 'member'
  created_at: string
  updated_at: string | null
}

export type Document = {
  id: string
  organization_id: string                 // ← Corrigé
  user_id: string | null
  file_url: string
  file_name: string
  file_type: string | null
  status: 'uploaded' | 'analyzing' | 'analyzed' | 'validated' | 'error'
  document_type: DocumentType | null
  extracted_data: ExtractedData | null
  confidence_score: number | null
  created_at: string
}

export type DocumentType =
  | 'supplier_invoice'
  | 'customer_invoice'
  | 'receipt'
  | 'quote'
  | 'other'

export type ExtractedData = {
  document_type: DocumentType
  third_party_name: string | null
  invoice_number: string | null
  transaction_date: string | null
  amount_ht: number | null
  vat_amount: number | null
  amount_ttc: number | null
  category: string | null
  payment_status: 'paid' | 'unpaid' | 'unknown'
  confidence_score: number
  needs_review: boolean
}

export type Transaction = {
  id: string
  organization_id: string                 // ← Corrigé
  document_id: string | null
  transaction_type: 'expense' | 'income' | 'receipt' | 'other'
  third_party_name: string | null
  category: string | null
  invoice_number: string | null
  transaction_date: string | null
  amount_ht: number
  vat_amount: number
  amount_ttc: number
  payment_status: 'paid' | 'unpaid' | 'unknown'
  validation_status: 'pending' | 'validated' | 'ignored'
  created_at: string
}

export type Subscription = {
  id: string
  organization_id: string                 // ← Corrigé
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  plan: 'free' | 'starter' | 'pro' | 'business'
  status: 'active' | 'inactive' | 'canceled' | 'past_due'
  current_period_end: string | null
  created_at: string
}

// Type alias pour la rétrocompatibilité (optionnel)
export type Company = Organization