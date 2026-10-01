import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('id')

    if (!documentId) {
      return new Response('ID de document manquant', { status: 400 })
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return new Response('Configuration serveur incomplète', { status: 500 })
    }

    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey
    )

    // 1. Récupérer les métadonnées du document
    const { data: doc, error: docErr } = await supabaseAdmin
      .from('documents')
      .select('file_url, file_type, file_name, organization_id')
      .eq('id', documentId)
      .single()

    if (docErr || !doc) {
      return new Response('Document introuvable en base', { status: 404 })
    }

    // 2. Extraire le chemin relatif dans le bucket Storage
    let storagePath = ''
    if (doc.file_url.includes('/documents/')) {
      storagePath = doc.file_url.split('/documents/')[1]
    } else {
      storagePath = `${doc.organization_id}/${doc.file_name}`
    }

    // 3. Télécharger le fichier via le client Administrateur (Bypasse RLS & Public CDN)
    const { data: blob, error: downloadErr } = await supabaseAdmin.storage
      .from('documents')
      .download(storagePath)

    if (downloadErr || !blob) {
      console.error('[DOWNLOAD PROXY ERR]', downloadErr)
      return new Response(`Fichier binaire introuvable sur le Storage : ${downloadErr?.message || 'Erreur'}`, { status: 404 })
    }

    const arrayBuffer = await blob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const mimeType = doc.file_type || blob.type || 'image/jpeg'

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `inline; filename="${doc.file_name}"`,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error: unknown) {
    console.error('[DOWNLOAD PROXY CATCH]', error)
    return new Response('Erreur serveur lors de la récupération du fichier', { status: 500 })
  }
}