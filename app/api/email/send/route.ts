import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { Resend } from 'resend'

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey || apiKey.trim() === '') {
      return NextResponse.json(
        { error: 'RESEND_API_KEY manquante dans votre fichier .env.local. Veuillez configurer votre clé Resend.' },
        { status: 500 }
      )
    }

    const resend = new Resend(apiKey)

    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return request.cookies.getAll() }, setAll() {} } }
    )

    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body = await request.json()
    const { type = 'custom', to, subject, html, invoiceNumber, clientName, amountTtc, portalUrl, companyName } = body

    if (!to || typeof to !== 'string' || !to.includes('@')) {
      return NextResponse.json({ error: 'Adresse e-mail destinataire invalide' }, { status: 400 })
    }

    const from = process.env.EMAIL_FROM || 'Paperasse.ai <onboarding@resend.dev>'
    let finalSubject = subject || 'Notification Paperasse.ai'
    let finalHtml = html || '<p>Message depuis Paperasse.ai</p>'

    if (type === 'invoice') {
      finalSubject = `Facture N° ${invoiceNumber || ''} — ${companyName || 'Votre artisan BTP'}`
      finalHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111;">
          <h2 style="color: #d97706;">Facture N° ${invoiceNumber || ''}</h2>
          <p>Bonjour ${clientName || ''},</p>
          <p>Veuillez trouver ci-dessous les détails de votre facture BTP.</p>
          <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:16px;margin:20px 0;">
            <p style="margin:0 0 8px 0;"><strong>Montant TTC :</strong> ${amountTtc || '—'} €</p>
            <p style="margin:0;"><strong>Émetteur :</strong> ${companyName || 'Artisan BTP'}</p>
          </div>
          <p style="color:#666;font-size:12px;">Édité via Paperasse.ai</p>
        </div>
      `
    } else if (type === 'accountant_invite') {
      finalSubject = `Accès Portail Comptable — ${companyName || 'Votre client BTP'}`
      finalHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111;">
          <h2 style="color: #7c3aed;">Portail Expert-Comptable</h2>
          <p>Bonjour,</p>
          <p>Votre client <strong>${companyName || 'entreprise BTP'}</strong> vous transmet un accès sécurisé à sa pré-comptabilité BTP.</p>
          <p style="margin:24px 0;">
            <a href="${portalUrl}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:bold;">
              Accéder aux exports FEC & pièces
            </a>
          </p>
        </div>
      `
    }

    const { data, error } = await resend.emails.send({
      from,
      to: [to.trim()],
      subject: finalSubject,
      html: finalHtml,
    })

    if (error) {
      console.error('[RESEND API ERR]', error)
      const errLower = (error.message || '').toLowerCase()
      if (errLower.includes('testing emails') || errLower.includes('validation_error')) {
        return NextResponse.json({
          error: `Mode Test Resend : En utilisant 'onboarding@resend.dev', vous devez saisir votre propre adresse e-mail de compte Resend (${user.email}) comme destinataire.`
        }, { status: 400 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data?.id, message: `E-mail envoyé avec succès à ${to}` })
  } catch (e: unknown) {
    console.error('[EMAIL CATCH ERR]', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur d\'envoi d\'e-mail' }, { status: 500 })
  }
}