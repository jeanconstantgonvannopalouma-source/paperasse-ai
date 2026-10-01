import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const chantierId = formData.get('chantierId') as string | null

    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return request.cookies.getAll() }, setAll() {} } }
    )

    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: profile } = await supabaseAdmin.from('profiles').select('organization_id').eq('id', user.id).maybeSingle()
    const orgId = profile?.organization_id

    const uploadedDocuments = []

    for (const file of files) {
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${file.name.split('.').pop()}`
      const filePath = `${orgId}/${fileName}`

      const { error: storageError } = await supabaseAdmin.storage
        .from('documents')
        .upload(filePath, Buffer.from(await file.arrayBuffer()), {
          contentType: file.type,
          upsert: true
        })

      if (storageError) continue

      // 🛡️ GÉNÉRATION DYNAMIQUE DE L'URL (Plus robuste)
      const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
      const fileUrl = `${projectUrl}/storage/v1/object/public/documents/${filePath}`

      const { data: doc } = await supabaseAdmin
        .from('documents')
        .insert({
          organization_id: orgId,
          user_id: user.id,
          file_url: fileUrl,
          file_name: file.name,
          file_type: file.type,
          status: 'uploaded',
          chantier_id: chantierId !== 'none' ? chantierId : null,
        })
        .select().single()

      if (doc) {
        uploadedDocuments.push(doc)
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        fetch(`${baseUrl}/api/documents/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Cookie': request.headers.get('cookie') || '' },
          body: JSON.stringify({ documentId: doc.id }),
        }).catch(() => {})
      }
    }

    return NextResponse.json({ success: true, documents: uploadedDocuments })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}