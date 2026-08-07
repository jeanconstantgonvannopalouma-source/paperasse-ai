'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import {
  Upload,
  FileText,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Image as ImageIcon,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────
type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

interface FileUpload {
  id: string
  file: File
  status: UploadStatus
  progress: number
  error?: string
  documentId?: string
}

// ─── Helpers ─────────────────────────────────────────────────
const ACCEPTED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
]

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

function getFileIcon(type: string) {
  if (type.startsWith('image/')) return <ImageIcon className="h-5 w-5" />
  return <FileText className="h-5 w-5" />
}

// ─── Page Upload ─────────────────────────────────────────────
export default function UploadDocumentPage() {
  const router = useRouter()
  const { user } = useAuth()
  const supabase = createClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const [files, setFiles] = useState<FileUpload[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  // ─── Validation d'un fichier ───────────────────────────────
  function validateFile(file: File): string | null {
    if (!ACCEPTED_TYPES.includes(file.type) && !file.name.match(/\.(pdf|jpe?g|png|webp|heic)$/i)) {
      return 'Format non supporté. Utilisez PDF, JPG, PNG ou WEBP.'
    }
    if (file.size > MAX_FILE_SIZE) {
      return `Fichier trop volumineux (max ${formatFileSize(MAX_FILE_SIZE)}).`
    }
    return null
  }

  // ─── Ajouter des fichiers à la file ────────────────────────
  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const list = Array.from(newFiles)
    const uploads: FileUpload[] = []

    for (const file of list) {
      const error = validateFile(file)
      uploads.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        status: error ? 'error' : 'idle',
        progress: 0,
        error: error || undefined,
      })
    }

    setFiles((prev) => [...prev, ...uploads])
    setGlobalError(null)
  }, [])

  // ─── Drag & Drop ───────────────────────────────────────────
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files?.length) {
      addFiles(e.dataTransfer.files)
    }
  }

  // ─── Supprimer un fichier de la liste ──────────────────────
  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  // ─── Upload d'un seul fichier ──────────────────────────────
  async function uploadSingleFile(
    item: FileUpload,
    organizationId: string,
    userId: string
  ): Promise<void> {
    const { file, id } = item

    // Marquer comme en cours
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, status: 'uploading', progress: 10 } : f
      )
    )

    try {
      // 1. Upload vers Supabase Storage
      const ext = file.name.split('.').pop() || 'pdf'
      const storagePath = `${organizationId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      setFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, progress: 30 } : f))
      )

      const { error: storageError } = await supabase.storage
        .from('documents')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        })

      if (storageError) throw storageError

      setFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, progress: 60 } : f))
      )

      // 2. Récupérer l'URL publique (ou signée)
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(storagePath)

      const fileUrl = urlData?.publicUrl || storagePath

      // 3. Créer l'entrée dans la table documents
      const { data: docData, error: dbError } = await supabase
        .from('documents')
        .insert({
          organization_id: organizationId,
          user_id: userId,
          file_url: fileUrl,
          file_name: file.name,
          file_type: file.type || null,
          status: 'uploaded',
        })
        .select('id')
        .single()

      if (dbError) throw dbError

      setFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...f,
                status: 'success',
                progress: 100,
                documentId: docData.id,
              }
            : f
        )
      )

      // 4. Déclencher l'analyse IA (optionnel, non bloquant)
      try {
        await fetch('/api/documents/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: docData.id }),
        })
      } catch {
        // L'analyse peut échouer sans bloquer l'upload
        console.warn('Analyse IA non disponible pour le moment')
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Erreur lors de l\'upload'
      setFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? { ...f, status: 'error', progress: 0, error: message }
            : f
        )
      )
    }
  }

  // ─── Lancer tous les uploads ───────────────────────────────
  async function handleUploadAll() {
    if (!user) return

    const toUpload = files.filter((f) => f.status === 'idle')
    if (toUpload.length === 0) return

    setIsUploading(true)
    setGlobalError(null)

    try {
      // Récupérer organization_id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      if (profileError) throw profileError

      if (!profile?.organization_id) {
        setGlobalError(
          'Aucune entreprise associée. Complétez d\'abord l\'onboarding.'
        )
        setIsUploading(false)
        return
      }

      // Upload séquentiel (plus fiable)
      for (const item of toUpload) {
        await uploadSingleFile(item, profile.organization_id, user.id)
      }
    } catch (err: unknown) {
      setGlobalError(
        err instanceof Error ? err.message : 'Erreur lors de l\'upload'
      )
    } finally {
      setIsUploading(false)
    }
  }

  const pendingCount = files.filter((f) => f.status === 'idle').length
  const successCount = files.filter((f) => f.status === 'success').length
  const allDone =
    files.length > 0 && files.every((f) => f.status === 'success' || f.status === 'error')

  // ─── Rendu ─────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto">
      {/* En-tête */}
      <div className="mb-8">
        <Link
          href="/documents"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux documents
        </Link>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
          Uploader des documents
        </h1>
        <p className="text-gray-500 mt-1">
          Factures, tickets, devis — l&apos;IA extrait les infos automatiquement
        </p>
      </div>

      {/* Zone de drop */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer
          transition-all duration-200
          ${
            isDragging
              ? 'border-blue-500 bg-blue-50 scale-[1.01]'
              : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50/30'
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files)
            e.target.value = ''
          }}
        />

        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Upload className="h-8 w-8 text-blue-600" />
        </div>

        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {isDragging
            ? 'Déposez vos fichiers ici'
            : 'Glissez-déposez vos documents'}
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          ou cliquez pour sélectionner des fichiers
        </p>
        <p className="text-xs text-gray-400">
          PDF, JPG, PNG, WEBP · Max {formatFileSize(MAX_FILE_SIZE)} par fichier
        </p>
      </div>

      {/* Erreur globale */}
      {globalError && (
        <div className="mt-4 bg-red-50 text-red-600 text-sm p-4 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <span>{globalError}</span>
        </div>
      )}

      {/* Liste des fichiers */}
      {files.length > 0 && (
        <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">
              {files.length} fichier{files.length > 1 ? 's' : ''} sélectionné
              {files.length > 1 ? 's' : ''}
            </h2>
            {pendingCount > 0 && (
              <Button
                onClick={handleUploadAll}
                disabled={isUploading}
                className="gap-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Upload en cours…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Uploader {pendingCount} fichier
                    {pendingCount > 1 ? 's' : ''}
                  </>
                )}
              </Button>
            )}
          </div>

          <div className="divide-y divide-gray-50">
            {files.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 px-6 py-4"
              >
                {/* Icône */}
                <div
                  className={`
                    w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
                    ${
                      item.status === 'success'
                        ? 'bg-green-100 text-green-600'
                        : item.status === 'error'
                          ? 'bg-red-100 text-red-600'
                          : item.status === 'uploading'
                            ? 'bg-blue-100 text-blue-600'
                            : 'bg-gray-100 text-gray-600'
                    }
                  `}
                >
                  {item.status === 'success' ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : item.status === 'error' ? (
                    <AlertCircle className="h-5 w-5" />
                  ) : item.status === 'uploading' ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    getFileIcon(item.file.type)
                  )}
                </div>

                {/* Infos */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate text-sm">
                    {item.file.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatFileSize(item.file.size)}
                    {item.status === 'error' && item.error && (
                      <span className="text-red-500"> · {item.error}</span>
                    )}
                    {item.status === 'success' && (
                      <span className="text-green-600"> · Uploadé avec succès</span>
                    )}
                    {item.status === 'uploading' && (
                      <span className="text-blue-600">
                        {' '}
                        · Upload… {item.progress}%
                      </span>
                    )}
                  </p>

                  {/* Barre de progression */}
                  {item.status === 'uploading' && (
                    <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-300"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Bouton supprimer */}
                {(item.status === 'idle' || item.status === 'error') && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removeFile(item.id)
                    }}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    aria-label="Supprimer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Footer actions */}
          {allDone && successCount > 0 && (
            <div className="px-6 py-4 bg-green-50 border-t border-green-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-sm text-green-700 font-medium">
                {successCount} document{successCount > 1 ? 's' : ''} uploadé
                {successCount > 1 ? 's' : ''} avec succès
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setFiles([])}
                >
                  Uploader d&apos;autres
                </Button>
                <Button onClick={() => router.push('/documents')}>
                  Voir mes documents
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Astuce */}
      <div className="mt-8 bg-blue-50 rounded-xl p-5 border border-blue-100">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">
          💡 Astuce pour les artisans
        </h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Photographiez vos tickets directement depuis le chantier</li>
          <li>• Les PDF de factures fournisseurs fonctionnent le mieux</li>
          <li>• L&apos;IA extrait automatiquement : montant, TVA, fournisseur, date</li>
        </ul>
      </div>
    </div>
  )
}