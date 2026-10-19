import { createBrowserClient } from '@supabase/ssr'

export const createClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    console.error("ERREUR: Les variables d'environnement Supabase sont manquantes !")
  }

  return createBrowserClient(
    url || '',
    key || ''
  )
}