'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Smartphone, Download, X, Share, Monitor, CheckCircle2 } from 'lucide-react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PwaBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isStandalone, setIsInstalled] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Vérifier si l'app est déjà installée
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
  }, [])

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setIsInstalled(true)
      }
      setDeferredPrompt(null)
    } else {
      setShowModal(true)
    }
  }

  if (isStandalone || dismissed) return null

  return (
    <>
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-4 rounded-2xl border border-slate-700 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500 text-slate-950 rounded-xl font-bold">
            <Smartphone className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              Installer Paperasse.ai sur votre téléphone
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Accédez à vos chantiers et scannez vos tickets en 1 clic depuis votre écran d'accueil.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            onClick={handleInstallClick}
            size="sm"
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs gap-2"
          >
            <Download className="h-4 w-4" />
            Installer l'application
          </Button>
          <button
            onClick={() => setDismissed(true)}
            className="text-slate-400 hover:text-white p-1 text-xs"
            title="Masquer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* MODAL INSTRUCTIONS D'INSTALLATION */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative text-gray-900">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-amber-600" />
                Installer sur votre téléphone
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <p className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                  🍏 Sur iPhone (Safari) :
                </p>
                <p className="text-slate-600">
                  1. Appuyez sur le bouton <strong>Partager</strong> <Share className="h-3.5 w-3.5 inline text-blue-600" /> en bas de votre écran.
                </p>
                <p className="text-slate-600">
                  2. Choisissez <strong>"Sur l'écran d'accueil"</strong>.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <p className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                  🤖 Sur Android (Chrome) :
                </p>
                <p className="text-slate-600">
                  1. Appuyez sur les <strong>3 petits points ⋮</strong> en haut à droite.
                </p>
                <p className="text-slate-600">
                  2. Cliquez sur <strong>"Installer l'application"</strong> ou "Ajouter à l'écran d'accueil".
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <p className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                  💻 Sur Ordinateur (Chrome / Edge) :
                </p>
                <p className="text-slate-600">
                  Cliquez sur l'icône d'installation <strong>⊕</strong> dans la barre d'adresse de votre navigateur en haut à droite.
                </p>
              </div>
            </div>

            <Button onClick={() => setShowModal(false)} className="w-full bg-slate-900 text-white font-semibold">
              J'ai compris
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
