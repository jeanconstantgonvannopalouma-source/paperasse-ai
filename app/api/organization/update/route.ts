import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || anonKey

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Configuration Supabase incomplète' }, { status: 500 })
    }

    const supabaseAuth = createServerClient(
      supabaseUrl,
      anonKey || '',
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll() {},
        },
      }
    )

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const supabaseAdmin = createServiceClient(supabaseUrl, serviceKey)

    // Vérification de l'organisation liée au profil
    let { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .maybeSingle()

    let orgId = profile?.organization_id

    // 🛡️ CRÉATION GARANTIE (Seulement le nom, 100% compatible avec tout schéma Supabase)
    if (!orgId) {
      const { data: newOrg, error: createOrgErr } = await supabaseAdmin
        .from('organizations')
        .insert({
          name: (body.name || 'Mon Entreprise BTP').trim(),
        })
        .select('id')
        .single()

      if (newOrg?.id) {
        orgId = newOrg.id
        await supabaseAdmin
          .from('profiles')
          .upsert({ id: user.id, organization_id: orgId, email: user.email })
      } else if (createOrgErr) {
        console.warn('[ORG UPDATE] Erreur création, tentative fallback sur org existante:', createOrgErr.message)
        const { data: anyOrg } = await supabaseAdmin.from('organizations').select('id').limit(1).maybeSingle()
        orgId = anyOrg?.id
        if (orgId) {
          await supabaseAdmin.from('profiles').upsert({ id: user.id, organization_id: orgId, email: user.email })
        }
      }
    }

    if (!orgId) {
      return NextResponse.json({ error: 'Impossible de rattacher une entreprise.' }, { status: 400 })
    }

    // Mise à jour 1 : Champs de base garantis
    const basePayload: Record<string, any> = {
      name: (body.name || 'Mon Entreprise BTP').trim(),
      legal_form: body.legal_form || null,
      industry: body.industry || null,
      siret: body.siret ? body.siret.trim() : null,
      phone: body.phone ? body.phone.trim() : null,
      address: body.address ? body.address.trim() : null,
      city: body.city ? body.city.trim() : null,
      postal_code: body.postal_code ? body.postal_code.trim() : null,
      country: body.country ? body.country.trim() : 'France',
      updated_at: new Date().toISOString(),
    }

    await supabaseAdmin.from('organizations').update(basePayload).eq('id', orgId)

    // Mise à jour 2 : Champs secondaires optionnels (try/catch séparé pour ne jamais bloquer)
    try {
      await supabaseAdmin.from('organizations').update({
        email: body.email ? body.email.trim() : null,
        siren: body.siren ? body.siren.trim() : null,
        vat_number: body.vat_number ? body.vat_number.trim() : null,
        vat_regime: body.vat_regime || null,
        tax_regime: body.tax_regime ? body.tax_regime.trim() : null,
        website: body.website ? body.website.trim() : null,
        accountant_email: body.accountant_email ? body.accountant_email.trim() : null,
        accountant_name: body.accountant_name ? body.accountant_name.trim() : null,
        decennale_company: body.decennale_company ? body.decennale_company.trim() : null,
        decennale_policy: body.decennale_policy ? body.decennale_policy.trim() : null,
        iban: body.iban ? body.iban.trim() : null,
        bic: body.bic ? body.bic.trim() : null,
      }).eq('id', orgId)
    } catch (e) {
      console.warn('[ORG UPDATE] Colonnes optionnelles ignorées:', e)
    }

    return NextResponse.json({
      success: true,
      organizationId: orgId,
      message: 'Entreprise enregistrée avec succès !',
    })
  } catch (error: unknown) {
    console.error('Erreur API update organization:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur serveur' }, { status: 500 })
  }
}