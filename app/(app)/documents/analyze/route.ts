import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { extractDocumentFromUrl } from '@/lib/openai/extract-document'

function getServiceSupabase() {const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if(!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant'
    )
  }

  return createClient(url, key)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const documentId = body.documentId as string | undefined

    if (!documentId) {
      return NextResponse.json(
        { error: 'documentId est requis' },
        { status: 400 }
      )
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY manquante sur le serveur' },
        { status: 500 }
      )
    }

    const supabase = getServiceSupabase()

    // 1. Charger le document
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (docError || !doc) {
      return NextResponse.json(
        { error: docError.message || 'Document introuvable' },
        { status: 404 }
      )
    }

    if (!doc.file_url) {
      return NextResponse.json(
        { error: "Le document n'a pas de file_url" },
        { status: 400 }
      )
    }

    // 2. Marquer "analyzing"
    await supabase
      .from('documents')
      .update({ status: 'analyzing' })
      .eq('id', documentId)

    // 3. Extraire avec OpenAI
    const extracted = await extractDocumentFromUrl(doc.file_url, doc.file_name)

    // 4. Sauvegarder le resultat
    const { data: updated, error: updateError } = await supabase
      .from('documents')
      .update({
        status: extracted.needs_review ? 'analyzed' : 'analyzed',
        document_type: extracted.document_type,
        extracted_data: extracted,
        confidence_score: extracted.confidence_score,
      })
      .eq('id', documentId)
      .select('*')
      .single()

    if (updateError) {
      // rollback statut
      await supabase
        .from('documents')
        .update({ status: 'error' })
        .eq('id', documentId)

      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: updated,
      extracted,
    })
  } catch (error: any) {
    console.error('Erreur /api/documents/analyze:', error)

    // tenter de marquer le document en erreur si on a l'id
    try {
      const body = await request.clone().json().catch(() => null)
      const documentId = body.documentId
      if (documentId) {
        const supabase = getServiceSupabase()
        await supabase
          .from('documents')
          .update({ status: 'error' })
          .eq('id', documentId)
      }
    } catch {
      // ignore
    }

    return NextResponse.json(
      {
        error:
          error.message ||
          "Erreur lors de l'analyse IA du document",
      },
      { status: 500 }
    )
  }
}
