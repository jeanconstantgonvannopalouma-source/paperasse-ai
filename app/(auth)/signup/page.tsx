'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    const cleanEmail = email.trim().toLowerCase()
    
    // URL de redirection dynamique (détecte si on est en prod sur Vercel ou en local)
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://paperasse-ai-pi.vercel.app'
    const redirectTo = `${origin}/onboarding`

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: redirectTo,
      },
    })

    if (signUpError) {
      setError(signUpError.message || "Erreur lors de la création du compte")
      setLoading(false)
      return
    }

    if (data.user) {
      if (data.session) {
        // Inscription directe sans confirmation obligatoire
        router.push('/onboarding')
      } else {
        // Confirmation e-mail requise
        setSuccess(`Compte créé avec succès ! Un e-mail de confirmation vient d'être envoyé à ${cleanEmail}. Cliquez sur le lien pour activer votre espace.`)
      }
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/80 px-4">
      <Card className="w-full max-w-md shadow-lg border-gray-200/80">
        <CardHeader className="text-center space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight text-gray-900 font-sans">Créer un compte</CardTitle>
          <CardDescription className="text-sm text-gray-500">
            Démarrez vos 14 jours d'essai gratuit sur Paperasse.ai
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 text-sm">
            {error && (
              <div className="bg-red-50 text-red-700 text-xs p-3.5 rounded-xl border border-red-200 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            {success && (
              <div className="bg-emerald-50 text-emerald-700 text-xs p-3.5 rounded-xl border border-emerald-200 flex items-start gap-2.5 font-medium">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                <span className="leading-relaxed">{success}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Adresse e-mail professionnelle</Label>
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
            <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold h-11" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Créer mon compte BTP
            </Button>

            <p className="text-sm text-gray-600 text-center">
              Déjà un compte ?{' '}
              <Link href="/login" className="text-amber-600 hover:underline font-semibold">
                Se connecter
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}