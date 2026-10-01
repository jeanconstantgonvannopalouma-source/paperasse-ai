'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Building, ShieldCheck, ArrowRight, Lock } from 'lucide-react'

export default function ExpertComptableRootPage() {
  const router = useRouter()
  const [tokenInput, setTokenInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const cleanToken = tokenInput.trim()

    if (!cleanToken) {
      setError("Veuillez saisir votre clé d'accès ou le token fourni par votre client.")
      return
    }

    // Redirection vers la route avec le token
    router.push(`/expert-comptable/${cleanToken}`)
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800/80 border border-slate-700 rounded-3xl p-8 space-y-6 shadow-2xl backdrop-blur-sm">
        <div className="text-center space-y-3">
          <div className="p-4 bg-amber-500 text-slate-950 rounded-2xl w-14 h-14 mx-auto flex items-center justify-center shadow-lg font-bold">
            <Building className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">Espace Expert-Comptable</h1>
          <p className="text-xs text-slate-400">
            Portail sécurisé de consultation des pièces et téléchargement du Fichier FEC (DGFiP)
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="token" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-amber-400" />
              Clé d'accès ou Token Client
            </Label>
            <Input
              id="token"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="ex: 9b7f82f6-8c45-4094..."
              className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 h-11 text-sm rounded-xl focus:border-amber-500 focus:ring-amber-500"
            />
          </div>

          <Button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold h-11 text-sm rounded-xl gap-2 shadow-md">
            Accéder au portail client
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>

        <div className="pt-4 border-t border-slate-700/60 text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          Accès sécurisé réservé aux cabinets d'expertise comptable
        </div>
      </div>
    </div>
  )
}
