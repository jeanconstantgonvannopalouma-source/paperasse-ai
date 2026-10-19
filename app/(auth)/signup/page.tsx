'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      let signUpError: any = null

      try {
        const res = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: \\/api/auth/callback\,
          },
        })
        signUpError = res.error
      } catch (clientErr: any) {
        signUpError = clientErr
      }

      // Si le navigateur echoue (Failed to fetch, CORS, bloqueur d'adblock), bascule transparente sur l'API Serveur
      if (signUpError && (signUpError.message?.includes('fetch') || signUpError.message?.includes('Failed') || !signUpError.status)) {
        console.warn('Fallback vers API serveur auth...')
        const apiRes = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })
        const apiData = await apiRes.json()

        if (!apiRes.ok) {
          throw new Error(apiData.error || "Erreur lors de la création du compte")
        }

        setSuccess("Compte créé avec succès ! Redirection en cours...")
        setTimeout(() => {
          router.push('/onboarding')
        }, 1200)
        return
      }

      if (signUpError) throw signUpError

      setSuccess("Compte créé avec succès ! Redirection en cours...")
      setTimeout(() => {
        router.push('/onboarding')
      }, 1000)
    } catch (err: any) {
      console.error('Signup error details:', err)
      setError(err.message || "Une erreur est survenue lors de l'inscription")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md shadow-lg border-t-4 border-t-amber-600">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-slate-900">Créer un compte</CardTitle>
          <CardDescription>Démarrez vos 14 jours d'essai gratuit sur Paperasse.ai</CardDescription>
        </CardHeader>
        <form onSubmit={handleSignup}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert className="bg-emerald-50 text-emerald-800 border-emerald-200">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Adresse e-mail professionnelle</label>
              <Input 
                type="email" 
                placeholder="nom@entreprise.fr" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Mot de passe</label>
              <Input 
                type="password" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
                minLength={6}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 rounded-md transition-colors" disabled={loading}>
              {loading ? 'Création de votre compte...' : 'Créer mon compte BTP'}
            </Button>
            <p className="text-sm text-center text-slate-600">
              Déjà un compte ? <Link href="/login" className="text-amber-600 font-semibold hover:underline">Se connecter</Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}