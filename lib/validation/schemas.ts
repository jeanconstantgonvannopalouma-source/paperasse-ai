import { z } from 'zod'

// ============================================
// SCHÉMAS DE VALIDATION POUR LES ROUTES API
// ============================================

// ----- Authentification -----
export const loginSchema = z.object({
  email: z.string().email('Email invalide').toLowerCase().trim(),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  remember: z.boolean().optional(),
})

export const signupSchema = z.object({
  email: z.string().email('Email invalide').toLowerCase().trim(),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères')
    .regex(/[A-Z]/, 'Doit contenir au moins une majuscule')
    .regex(/[a-z]/, 'Doit contenir au moins une minuscule')
    .regex(/[0-9]/, 'Doit contenir au moins un chiffre')
    .regex(/[^A-Za-z0-9]/, 'Doit contenir au moins un caractère spécial'),
  fullName: z.string().min(2, 'Nom trop court').max(100).trim(),
  termsAccepted: z.boolean().refine((val) => val === true, {
    message: 'Vous devez accepter les CGU'
  }),
})

// ----- Onboarding -----
export const onboardingSchema = z.object({
  businessName: z.string().min(2).max(200).trim(),
  businessType: z.enum(['auto_entrepreneur', 'eurl', 'sarl', 'sas', 'sasu', 'sci', 'association', 'autre']),
  siret: z.string().regex(/^\d{14}$/, 'SIRET invalide (14 chiffres)').optional(),
  tvaNumber: z.string().regex(/^FR\d{11}$/, 'Numéro TVA invalide (FR + 11 chiffres)').optional(),
  address: z.object({
    street: z.string().min(5).max(200),
    city: z.string().min(2).max(100),
    postalCode: z.string().regex(/^\d{5}$/, 'Code postal invalide'),
    country: z.string().default('France'),
  }),
  phone: z.string().regex(/^(\+33|0)[1-9](\d{8})$/, 'Numéro français invalide').optional(),
})

// ----- Documents (factures, tickets, reçus) -----
export const documentUploadSchema = z.object({
  documentType: z.enum(['facture', 'ticket', 'reçu', 'autre']),
  amount: z.number().positive('Montant invalide').max(1_000_000),
  currency: z.string().length(3).default('EUR'),
  date: z.string().datetime({ offset: true }),
  category: z.string().min(1).max(100).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  notes: z.string().max(2000).optional(),
})

// ----- Paramètres utilisateur -----
export const userSettingsSchema = z.object({
  fullName: z.string().min(2).max(100).trim().optional(),
  email: z.string().email().toLowerCase().trim().optional(),
  language: z.enum(['fr', 'en', 'es', 'de']).optional(),
  timezone: z.string().optional(),
  notifications: z.object({
    email: z.boolean(),
    push: z.boolean(),
    weeklyReport: z.boolean(),
  }).optional(),
  password: z.object({
    current: z.string().min(8),
    new: z.string().min(8).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/),
    confirm: z.string(),
  }).refine(data => data.new === data.confirm, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirm'],
  }).optional(),
})

// ----- Webhooks (Supabase, Stripe, etc.) -----
export const webhookSignatureSchema = z.object({
  signature: z.string().min(1),
  payload: z.string().min(1),
})

// ----- Export comptable -----
export const exportConfigSchema = z.object({
  format: z.enum(['csv', 'xlsx', 'pdf', 'json']),
  dateRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
  includeCategories: z.array(z.string()).optional(),
  includeTags: z.boolean().optional(),
  groupBy: z.enum(['month', 'quarter', 'year', 'category', 'none']).default('month'),
})

// ============================================
// UTILITAIRES DE VALIDATION
// ============================================

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: Record<string, string[]> }

/**
 * Valide et sanitise les données entrantes
 */
export function validateRequest<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): ValidationResult<z.infer<T>> {
  const result = schema.safeParse(data)

  if (result.success) {
    return { success: true, data: result.data }
  }

  // Formater les erreurs pour le frontend
  const errors: Record<string, string[]> = {}
  for (const issue of result.error.issues) {
    const path = issue.path.join('.')
    if (!errors[path]) errors[path] = []
    errors[path].push(issue.message)
  }

  return { success: false, errors }
}

/**
 * Helper pour réponse d'erreur standardisée
 */
export function validationErrorResponse(errors: Record<string, string[]>) {
  return new Response(
    JSON.stringify({
      error: 'Validation échouée',
      errors,
      code: 'VALIDATION_ERROR',
    }),
    {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}

// ============================================
// SANITISATION DES DONNÉES
// ============================================

/**
 * Sanitize une chaîne pour prévenir XSS/injection
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>"'&]/g, (char) => {
      const map: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;',
      }
      return map[char] || char
    })
    .trim()
}

/**
 * Sanitize un objet récursivement
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized: Record<string, any> = {}

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value)
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(v => typeof v === 'string' ? sanitizeString(v) : v)
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized as T
}

// ============================================
// TYPES EXPORTS
// ============================================

export type LoginInput = z.infer<typeof loginSchema>
export type SignupInput = z.infer<typeof signupSchema>
export type OnboardingInput = z.infer<typeof onboardingSchema>
export type DocumentUploadInput = z.infer<typeof documentUploadSchema>
export type UserSettingsInput = z.infer<typeof userSettingsSchema>
export type WebhookSignatureInput = z.infer<typeof webhookSignatureSchema>
export type ExportConfigInput = z.infer<typeof exportConfigSchema>