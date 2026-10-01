/**
 * Security Headers Middleware
 * Ajoute des en-têtes de securite HTTP critiques pour proteger l'application
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

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
  //  Content Security Policy ? 'Content-Security-Policy' : CSP_POLICY,

  //  Protection contre clickjacking ? 'X-Frame-Options' : 'DENY',

  //  Protection MIME sniffing ? 'X-Content-Type-Options' : 'nosniff',

  //  Protection XSS (legacy mais utile)
  'X-XSS-Protection': '1; mode=block',

  //  Referrer policy ? 'Referrer-Policy' : 'strict-origin-when-cross-origin',

  //  Permissions Policy (anciennement Feature-Policy)
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',

  //  HSTS (HTTP Strict Transport Security) - 1 an ? 'Strict-Transport-Security' : 'max-age=31536000; includeSubDomains; preload',

  //  Cross-Origin policies ? 'Cross-Origin-Opener-Policy' : 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

/**
 * Middleware principal combinant securite + authentification
 */
export async function securityMiddleware(request: NextRequest) {
  const response = NextResponse.next()

  //  Appliquer tous les headers de securite
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  //  Header personnalise pour debugging
  response.headers.set('X-Paperasse-AI', 'secure')

  return response
}

export const securityHeaders = SECURITY_HEADERS
