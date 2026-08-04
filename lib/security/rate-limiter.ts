/**
 * Simple in-memory rate limiter for API routes
 * Production: replace with Redis (Upstash, Redis Cloud) for distributed rate limiting
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

const RATE_LIMITS = {
  // Limite par IP
  default: { maxRequests: 100, windowMs: 60_000 },    // 100 req/min
  auth: { maxRequests: 10, windowMs: 60_000 },         // 10 req/min (login)
  api: { maxRequests: 200, windowMs: 60_000 },         // 200 req/min
  webhook: { maxRequests: 50, windowMs: 60_000 },      // 50 req/min
  upload: { maxRequests: 20, windowMs: 60_000 },       // 20 req/min (uploads)
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfter?: number
}

/**
 * Vérifie si une requête est autorisée selon le rate limit
 */
export function checkRateLimit(
  identifier: string,
  tier: keyof typeof RATE_LIMITS = 'default'
): RateLimitResult {
  const limit = RATE_LIMITS[tier]
  const now = Date.now()

  let entry = rateLimitStore.get(identifier)

  // Réinitialiser si la fenêtre a expiré
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + limit.windowMs }
    rateLimitStore.set(identifier, entry)
  }

  entry.count++

  const allowed = entry.count <= limit.maxRequests
  const remaining = Math.max(0, limit.maxRequests - entry.count)

  return {
    allowed,
    remaining,
    resetAt: entry.resetAt,
    retryAfter: allowed ? undefined : Math.ceil((entry.resetAt - now) / 1000),
  }
}

/**
 * Nettoie les entrées expirées du store (à appeler périodiquement)
 */
export function cleanupRateLimits(): number {
  const now = Date.now()
  let cleaned = 0

  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key)
      cleaned++
    }
  }

  return cleaned
}

// Nettoyage automatique toutes les 5 minutes
setInterval(cleanupRateLimits, 5 * 60 * 1000)