'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, AlertCircle, WifiOff } from 'lucide-react'

function formatAuthError(msg: string): string {
  const lower = msg.toLowerCase()
  if (lower.includes('failed to fetch') || lower.includes('fetcherror') || lower.includes('networkerror')) {
    return "Impossible de joindre le serveur d'authentification. Vérifiez votre connexion internet ou que l'URL Supabase dans .env.local est correcte."
  }
  if (lower.includes('email not confirmed')) {
    return "Votre adresse e-mail n'a pas encore été confirmée. Vérifiez votre boîte de réception ou vos spams."
  }
  if (lower.includes('invalid login credentials') || lower.includes('invalid_credentials')) {
    return "E-mail ou mot de passe incorrect."
  }
  if (lower.includes('too many requests') || lower.includes('rate limit')) {
    return "Trop de tentatives. Veuillez patienter quelques minutes avant de réessayer."
  }
  return msg || "Impossible de vous connecter."
}

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const cleanEmail = email.trim().toLowerCase()

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      })

      if (signInError) {
        console.warn('[AUTH LOGIN ERR]', signInError)
        setError(formatAuthError(signInError.message))
        setLoading(false)
        return
      }

      if (data?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', data.user.id)
          .maybeSingle()

        if (profile?.organization_id) {
          router.push('/dashboard')
        } else {
          router.push('/onboarding')
        }
      }
    } catch (err: unknown) {
      console.error('[AUTH CATCH ERR]', err)
      setError("Erreur réseau : impossible de joindre les serveurs Supabase.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/80 px-4">
      <Card className="w-full max-w-md shadow-lg border-gray-200/80">
        <CardHeader className="text-center space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight text-gray-900">Connexion</CardTitle>
          <CardDescription className="text-sm text-gray-500">
            Accédez à votre espace Paperasse.ai
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-700 text-xs p-3.5 rounded-xl border border-red-200 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Adresse e-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="artisan@exemple.fr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-gray-50/50"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-gray-50/50"
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold h-11" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Se connecter
            </Button>

            <p className="text-sm text-gray-600 text-center">
              Pas encore de compte ?{' '}
              <Link href="/signup" className="text-amber-600 hover:underline font-semibold">
                Créer un compte
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
