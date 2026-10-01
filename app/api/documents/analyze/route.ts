import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { extractDocumentFromBuffer } from '../../../../lib/openai/extract-document'

export async function POST(request: NextRequest) {
  let docIdToUpdate: string | null = null

  try {
    const { documentId } = await request.json()

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID requis' }, { status: 400 })
    }

    docIdToUpdate = documentId

    // Client Authentifié pour vérifier l'accès multi-tenant
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll() {},
        },
      }
    )

    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Client Admin pour effectuer l'analyse et la mise à jour
    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Récupérer le document ET vérifier l'organisation
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .maybeSingle()

    const { data: document, error: docError } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('organization_id', profile?.organization_id)
      .single()

    if (docError || !document) {
      console.error("[ANALYZE] Document introuvable ou accès refusé:", docError)
      return NextResponse.json({ error: 'Document introuvable ou accès non autorisé' }, { status: 404 })
    }

    console.log(`[ANALYZE] Début analyse IA pour doc ${documentId}`)

    // Passer en statut 'analyzing'
    await supabaseAdmin
      .from('documents')
      .update({ status: 'analyzing' })
      .eq('id', documentId)

    // 2. Récupérer le fichier binaire depuis Supabase Storage
    let fileBuffer: Buffer | null = null
    let mimeType = document.file_type || 'image/jpeg'
    const fileUrl: string = document.file_url || ''

    if (fileUrl.includes('/storage/v1/object/')) {
      try {
        const parts = fileUrl.split('/storage/v1/object/')
        const cleanPath = parts[1].replace(/^(public|authenticated)\//, '')
        const pathSegments = cleanPath.split('/')
        const bucket = pathSegments[0]
        const filePath = pathSegments.slice(1).join('/')

        const { data: blob, error: storageErr } = await supabaseAdmin.storage.from(bucket).download(filePath)
        if (!storageErr && blob) {
          const arrayBuffer = await blob.arrayBuffer()
          fileBuffer = Buffer.from(arrayBuffer)
          if (blob.type) mimeType = blob.type
        }
      } catch (e) {
        console.warn(`[ANALYZE] Warning Storage SDK:`, e)
      }
    }

    // Fallback HTTP Fetch
    if (!fileBuffer) {
      let absoluteUrl = fileUrl
      if (fileUrl.startsWith('/')) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        absoluteUrl = `${baseUrl}${fileUrl}`
      }

      const res = await fetch(absoluteUrl)
      if (!res.ok) throw new Error(`Échec du téléchargement fichier (${res.status})`)
      const arrayBuffer = await res.arrayBuffer()
      fileBuffer = Buffer.from(arrayBuffer)
    }

    if (!fileBuffer) {
      throw new Error("Impossible de charger le fichier binaire")
    }

    // 3. Extraction par l'IA
    const extractedData = await extractDocumentFromBuffer(fileBuffer, mimeType, document.file_name)

    // 4. Succès : Mise à jour en BDD
    const { error: updateError } = await supabaseAdmin
      .from('documents')
      .update({
        status: 'analyzed',
        document_type: extractedData.document_type || 'supplier_invoice',
        extracted_data: extractedData,
        confidence_score: extractedData.confidence_score || 0.9,
      })
      .eq('id', documentId)

    if (updateError) throw updateError

    console.log(`[ANALYZE] Analyse réussie avec succès pour doc ${documentId}`)
    return NextResponse.json({ success: true, data: extractedData })

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Erreur d\'analyse IA'
    console.error(`[ANALYZE] Erreur sur doc ${docIdToUpdate}:`, errorMsg)

    // 🛡️ SÉCURITÉ RESILIENCE : Si l'IA plante, on marque le document en statut 'error' en BDD !
    if (docIdToUpdate) {
      const supabaseAdmin = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      await supabaseAdmin
        .from('documents')
        .update({
          status: 'error',
          extracted_data: { error: errorMsg },
        })
        .eq('id', docIdToUpdate)
        .catch(() => {})
    }

    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
