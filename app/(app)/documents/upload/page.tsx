'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Upload,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  HardHat,
  Image as ImageIcon,
  Camera,
  RefreshCw,
} from 'lucide-react'

interface ChantierOption {
  id: string
  name: string
}

export default function UploadPage() {
  const router = useRouter()
  const supabase = createClient()

  const [files, setFiles] = useState<File[]>([])
  const [chantiers, setChantiers] = useState<ChantierOption[]>([])
  const [selectedChantier, setSelectedChantier] = useState<string>('none')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // WebCam Modal State (Desktop Fallback)
  const [showWebcam, setShowWebcam] = useState(false)
  const [webcamError, setWebcamError] = useState<string | null>(null)
  const [cameraLoading, setCameraLoading] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null)
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    async function loadChantiers() {
      const { data } = await supabase
        .from('chantiers')
        .select('id, name')
        .order('created_at', { ascending: false })
      if (data) setChantiers(data)
    }
    loadChantiers()
  }, [supabase])

  // Déclencheur intelligent photo
  const handleCameraClick = () => {
    // Si mobile / tablette touch -> On utilise l'appareil photo natif iOS/Android (0 bug de permission)
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    
    if (isMobile && nativeCameraInputRef.current) {
      nativeCameraInputRef.current.click()
    } else {
      // Sur PC / Mac -> On ouvre le modal webcam
      startWebcam()
    }
  }

  // Démarrer la webcam desktop
  const startWebcam = async () => {
    setCameraLoading(true)
    setWebcamError(null)
    setShowWebcam(true)

    try {
      let stream: MediaStream | null = null
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true })
      }

      if (stream) {
        setMediaStream(stream)
      }
    } catch (err: unknown) {
      console.warn('Erreur accès caméra:', err)
      const e = err as { name?: string }
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        setWebcamError("L'accès à la caméra a été bloqué par votre navigateur. Autorisez la caméra dans l'URL (cadenas 🔒) ou importez une photo depuis votre galerie.")
      } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
        setWebcamError("Aucune caméra n'a été détectée. Utilisez le bouton 'Choisir dans la galerie'.")
      } else {
        setWebcamError("Impossible de démarrer la caméra.")
      }
    } finally {
      setCameraLoading(false)
    }
  }

  useEffect(() => {
    if (showWebcam && videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream
    }
  }, [showWebcam, mediaStream])

  const stopWebcam = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop())
      setMediaStream(null)
    }
    setShowWebcam(false)
    setWebcamError(null)
  }

  const captureSnapshot = () => {
    if (!videoRef.current) return
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => {
        if (blob) {
          const snapshotFile = new File([blob], `photo-ticket-${Date.now()}.jpg`, {
            type: 'image/jpeg',
          })
          setFiles((prev) => [...prev, snapshotFile])
          stopWebcam()
        }
      }, 'image/jpeg', 0.9)
    }
  }

  const addFiles = (list: FileList | File[]) => {
    const arr = Array.from(list).filter(
      (f) => f.type.startsWith('image/') || f.type === 'application/pdf'
    )
    if (arr.length === 0) {
      setError('Formats acceptés : photos (JPG/PNG/WEBP) ou PDF')
      return
    }
    setError(null)
    setFiles((prev) => [...prev, ...arr])
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) addFiles(e.target.files)
    e.target.value = ''
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
  }, [])

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (files.length === 0) return

    setUploading(true)
    setError(null)
    setSuccessMsg(null)

    try {
      const formData = new FormData()
      files.forEach((file) => formData.append('files', file))
      if (selectedChantier !== 'none') {
        formData.append('chantierId', selectedChantier)
      }

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Échec de l'envoi")

      setSuccessMsg(data.message || `${files.length} fichier(s) envoyé(s). Analyse IA en cours.`)
      setFiles([])

      setTimeout(() => {
        router.push('/documents')
      }, 1200)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'upload')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6">
      {/* En-tête */}
      <div className="flex items-center gap-4 border-b border-gray-100 pb-4">
        <Link href="/documents">
          <Button variant="outline" size="icon" type="button" className="h-9 w-9">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Scanner / Déposer des pièces</h1>
          <p className="text-sm text-gray-500">
            Prenez vos tickets en photo ou déposez vos factures PDF.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-700 text-sm">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-emerald-700 text-sm font-medium">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Choix du chantier */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 space-y-2 shadow-sm">
          <Label className="flex items-center gap-2 text-gray-700 font-semibold text-sm">
            <HardHat className="h-4 w-4 text-amber-600" />
            Rattacher à un chantier (Optionnel)
          </Label>
          <Select value={selectedChantier} onValueChange={setSelectedChantier}>
            <SelectTrigger className="bg-gray-50/50">
              <SelectValue placeholder="Choisir un chantier..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Aucun chantier particulier</SelectItem>
              {chantiers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Inputs cachés pour déclencheurs */}
        <input
          id="file-input-multi"
          type="file"
          multiple
          accept="image/*,application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />
        <input
          ref={nativeCameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Zone de Drag & Drop */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-input-multi')?.click()}
          className="border-2 border-dashed border-gray-300 hover:border-amber-500 bg-gray-50/60 hover:bg-amber-50/30 transition-all rounded-2xl p-8 sm:p-12 text-center cursor-pointer flex flex-col items-center justify-center space-y-3 group"
        >
          <div className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100 group-hover:scale-110 transition-transform">
            <Upload className="h-8 w-8 text-amber-600" />
          </div>
          <div>
            <p className="text-base font-bold text-gray-900">
              Glissez vos tickets / factures ici ou cliquez pour choisir
            </p>
            <p className="text-xs text-gray-500 mt-1">
              JPG, PNG, WEBP, PDF — Jusqu'à 12 Mo par fichier
            </p>
          </div>
        </div>

        {/* Boutons d'action : Photo vs Galerie */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleCameraClick}
            className="flex items-center justify-center gap-2.5 p-4 rounded-xl border-2 border-amber-300 bg-amber-50 text-amber-900 font-bold hover:bg-amber-100 transition-colors shadow-sm"
          >
            <Camera className="h-5 w-5 text-amber-600" />
            Prendre une photo en direct
          </button>

          <button
            type="button"
            className="flex items-center justify-center gap-2.5 p-4 rounded-xl border-2 border-gray-200 bg-white text-gray-800 font-medium hover:bg-gray-50 transition-colors shadow-sm"
            onClick={() => document.getElementById('file-input-multi')?.click()}
          >
            <ImageIcon className="h-5 w-5 text-gray-500" />
            Choisir dans la galerie / dossier
          </button>
        </div>

        {/* File d'attente des fichiers sélectionnés */}
        {files.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-gray-900 text-sm">
                Fichiers prêts à l'envoi ({files.length})
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => setFiles([])}
              >
                Tout effacer
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm"
                >
                  <div className="flex items-center gap-3 truncate">
                    {file.type.startsWith('image/') ? (
                      <ImageIcon className="h-5 w-5 text-blue-600 flex-shrink-0" />
                    ) : (
                      <FileText className="h-5 w-5 text-red-600 flex-shrink-0" />
                    )}
                    <div className="truncate">
                      <p className="font-semibold text-gray-900 text-xs truncate">{file.name}</p>
                      <p className="text-[10px] text-gray-400">
                        {(file.size / 1024 / 1024).toFixed(2)} Mo
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="text-gray-400 hover:text-red-600 p-1 rounded-md hover:bg-gray-200/50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button
          type="submit"
          disabled={files.length === 0 || uploading}
          className="w-full bg-amber-600 hover:bg-amber-700 text-white h-12 text-base font-bold shadow-md gap-2 rounded-xl"
        >
          {uploading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Envoi & analyse IA en cours...
            </>
          ) : (
            <>
              <Upload className="h-5 w-5" />
              Envoyer et analyser {files.length > 0 ? `(${files.length})` : ''}
            </>
          )}
        </Button>
      </form>

      {/* MODAL WEBCAM (DESKTOP) */}
      {showWebcam && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <Camera className="h-5 w-5 text-amber-600" /> Prise de photo en direct
              </h3>
              <button onClick={stopWebcam} className="text-gray-400 hover:text-gray-700 p-1">
                <X className="h-6 w-6" />
              </button>
            </div>

            {webcamError ? (
              <div className="p-4 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 space-y-2">
                <p className="font-bold flex items-center gap-1.5"><AlertCircle className="h-4 w-4" /> Impossible d'activer la caméra</p>
                <p>{webcamError}</p>
              </div>
            ) : (
              <div className="aspect-[4/3] bg-black rounded-xl overflow-hidden relative flex items-center justify-center">
                {cameraLoading && (
                  <div className="text-white text-xs flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
                    Activation de la caméra...
                  </div>
                )}
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={stopWebcam}>
                Fermer
              </Button>
              {!webcamError && (
                <Button type="button" onClick={captureSnapshot} className="bg-amber-600 hover:bg-amber-700 text-white gap-2 font-semibold">
                  <Camera className="h-4 w-4" />
                  Prendre la photo
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
