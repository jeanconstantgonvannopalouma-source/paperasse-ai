import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Security Headers
const CSP_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://js.braintreegateway.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: https: blob:",
  "connect-src 'self' https://*.supabase.co https://api.openai.com wss://*.supabase.co",
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP_POLICY,
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

// Rate Limiting
interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

const RATE_LIMITS = {
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

function checkRateLimit(
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

function cleanupRateLimits(): number {
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

// Fonction pour obtenir l'IP client réelle
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIP = request.headers.get('x-real-ip')
  if (realIP) return realIP

  return request.headers.get('host')?.split(':')[0] || 'unknown'
}

// Routes publiques autorisées sans authentification
const PUBLIC_ROUTES = [
  '/login',
  '/signup',
  '/pricing',
  '/api',
  '/_next',
  '/static',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml'
]

export default async function proxy(request: NextRequest) {
  // 1️⃣ Appliquer les headers de sécurité
  const response = NextResponse.next()

  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  response.headers.set('X-Paperasse-AI', 'secure')

  // 2️⃣ Rate limiting par IP (sauf routes statiques/next)
  const isStaticOrNext =
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.startsWith('/static') ||
    request.nextUrl.pathname.startsWith('/favicon') ||
    request.nextUrl.pathname === '/favicon.ico' ||
    request.nextUrl.pathname === '/robots.txt' ||
    request.nextUrl.pathname === '/sitemap.xml'

  if (!isStaticOrNext) {
    const ip = getClientIP(request)
    const rateLimit = checkRateLimit(ip, 'api')

    response.headers.set('X-RateLimit-Limit', '200')
    response.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString())
    response.headers.set('X-RateLimit-Reset', new Date(rateLimit.resetAt).toISOString())

    if (!rateLimit.allowed) {
      return new NextResponse(JSON.stringify({
        error: 'Trop de requêtes',
        retryAfter: rateLimit.retryAfter
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': rateLimit.retryAfter?.toString() || '60',
          ...Object.fromEntries(response.headers.entries())
        }
      })
    }
  }

  // 3️⃣ Gestion authentification Supabase
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Fix critique : On modifie la réponse, pas la requête
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set({
              name,
              value,
              ...options,
            })
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Pages publiques (pas de redirection)
  const isPublicPath = PUBLIC_ROUTES.some(route =>
    request.nextUrl.pathname.startsWith(route)
  )

  // Rediriger les utilisateurs non connectés vers login
  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Conserver la destination initiale pour redirection post-login
    url.searchParams.set('redirectTo', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  // ✅ Utilisateur authentifié ou route publique → continuer
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (handled separately but we still process them for security)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, robots.txt, sitemap.xml
     * - Public files extensions
     */
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}