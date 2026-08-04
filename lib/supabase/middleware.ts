import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes publiques autorisées sans authentification
const PUBLIC_ROUTES = [
  '/login',
  '/signup',
  '/pricing',
  '/api',
  '/_next',
  '/static',
]

// Middleware de gestion de session Supabase avec validation robuste
export async function updateSession(request: NextRequest) {
  // 🔒 Sécurité : Ne pas traiter les routes API (laisser au gestionnaire API)
  if (PUBLIC_ROUTES.some((route) => request.nextUrl.pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Initialisation client Supabase (serveur)
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
            request.cookies.set({
              name,
              value,
              ...options,
            })
          })
        },
      },
    }
  )

  // Vérification utilisateur
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 🔐 Redirection intelligente vers login si non authentifié
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // 🔁 Conserver la destination initiale pour redirection post-login
    url.searchParams.set('redirectTo', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  // ✅ Utilisateur authentifié → continuer
  return NextResponse.next({
    request: {
      // Passer les headers Supabase
      headers: request.headers,
    },
  })
}