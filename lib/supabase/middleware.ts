import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes publiques autorisees sans authentification
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
  //  Securite : Ne pas traiter les routes API (laisser au gestionnaire API)
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
          // Fix critique : On modifie la reponse, pas la requête
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

  // Verification utilisateur
  const {
    data: { user },
  } = await supabase.auth.getUser()

  //  Redirection intelligente vers login si non authentifie
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    //  Conserver la destination initiale pour redirection post-login
    url.searchParams.set('redirectTo', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  // âœ… Utilisateur authentifie â†’ continuer
  return NextResponse.next({
    request: {
      // Passer les headers Supabase
      headers: request.headers,
    },
  })
}
