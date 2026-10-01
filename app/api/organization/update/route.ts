import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 1. Vérification de l'utilisateur connecté
    const responseHeaders = new Headers()
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

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return NextResponse.json({ error: 'Clé de service introuvable' }, { status: 500 })
    }

    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey
    )

    // 2. Vérifier si le profil a une organisation
    let { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .maybeSingle()

    let orgId = profile?.organization_id

    // 🛡️ CRÉATION AUTOMATIQUE : Si l'organisation n'existe pas, on la crée et on la lie au profil !
    if (!orgId) {
      const { data: newOrg, error: createOrgErr } = await supabaseAdmin
        .from('organizations')
        .insert({
          name: (body.name || 'Mon Entreprise BTP').trim(),
          email: user.email,
        })
        .select('id')
        .single()

      if (createOrgErr || !newOrg) {
        throw new Error("Impossible de créer l'entreprise : " + (createOrgErr?.message || 'Erreur BDD'))
      }

      orgId = newOrg.id

      // Lien du profil à la nouvelle organisation
      await supabaseAdmin
        .from('profiles')
        .upsert({ id: user.id, organization_id: orgId, email: user.email })
    }

    // 3. Mise à jour complète de l'entreprise
    const corePayload: Record<string, any> = {
      name: (body.name || 'Mon Entreprise BTP').trim(),
      legal_form: body.legal_form || null,
      industry: body.industry || null,
      siret: body.siret ? body.siret.trim() : null,
      siren: body.siren ? body.siren.trim() : null,
      vat_number: body.vat_number ? body.vat_number.trim() : null,
      vat_regime: body.vat_regime || null,
      tax_regime: body.tax_regime ? body.tax_regime.trim() : null,
      phone: body.phone ? body.phone.trim() : null,
      email: body.email ? body.email.trim() : null,
      website: body.website ? body.website.trim() : null,
      address: body.address ? body.address.trim() : null,
      city: body.city ? body.city.trim() : null,
      postal_code: body.postal_code ? body.postal_code.trim() : null,
      country: body.country ? body.country.trim() : 'France',
      accountant_email: body.accountant_email ? body.accountant_email.trim() : null,
      updated_at: new Date().toISOString(),
    }

    const { error: updateErr } = await supabaseAdmin
      .from('organizations')
      .update(corePayload)
      .eq('id', orgId)

    if (updateErr) throw updateErr

    // Colonnes BTP optionnelles
    try {
      await supabaseAdmin
        .from('organizations')
        .update({
          accountant_name: body.accountant_name ? body.accountant_name.trim() : null,
          decennale_company: body.decennale_company ? body.decennale_company.trim() : null,
          decennale_policy: body.decennale_policy ? body.decennale_policy.trim() : null,
          iban: body.iban ? body.iban.trim() : null,
          bic: body.bic ? body.bic.trim() : null,
          bank_name: body.bank_name ? body.bank_name.trim() : null,
        })
        .eq('id', orgId)
    } catch (e) {
      // Ignorer si colonnes BTP absentes du schéma
    }

    return NextResponse.json({
      success: true,
      orgId,
      message: 'Informations entreprise enregistrées et liées à votre profil avec succès !',
    })
  } catch (error: unknown) {
    console.error('Erreur API update organization:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur serveur' }, { status: 500 })
  }
}
