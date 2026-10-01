import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    const responseHeaders = new Headers()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              responseHeaders.append('Set-Cookie', `${name}=${value}`)
            })
          },
        },
      }
    )

    // Récupérer les transactions validées
    let query = supabase
      .from('transactions')
      .select('*, chantiers(name)')
      .eq('validation_status', 'validated')

    if (start) query = query.gte('transaction_date', start)
    if (end) query = query.lte('transaction_date', end)

    const { data: transactions, error } = await query

    if (error) throw error

    // Formater en CSV avec séparateur ";" (format requis par Excel en France)
    const csvHeaders = [
      'Date',
      'Facture N°',
      'Tiers (Fournisseur/Client)',
      'Type',
      'Catégorie',
      'Chantier',
      'Montant HT (€)',
      'Montant TVA (€)',
      'Montant TTC (€)',
      'Autoliquidation (Oui/Non)',
      'Mode de règlement',
    ].join(';')

    const csvRows = (transactions || []).map((t) => {const chantierName = t.chantiers ? (t.chantiers as any).name : ''
      return [
        t.transaction_date || '',
        `"${(t.invoice_number || '').replace(/"/g, '""')}"`,
        `"${(t.third_party_name || '').replace(/"/g, '""')}"`,
        t.transaction_type,
        t.category || '',
        `"${chantierName.replace(/"/g, '""')}"`,
        (t.amount_ht || 0).toString().replace('.', ','),
        (t.vat_amount || 0).toString().replace('.', ','),
        (t.amount_ttc || 0).toString().replace('.', ','),
        t.is_autoliquidation ? 'Oui' : 'Non',
        t.payment_method || 'unknown',
      ].join(';')
    })

    const csvContent = '\uFEFF' + [csvHeaders, ...csvRows].join('\n') // UTF-8 BOM pour Excel

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="export_comptable_paperasse_ai.csv"',
      },
    })
  } catch (error: any) {
    console.error('Erreur Export CSV:', error)
    return NextResponse.json({ error: "Échec de la génération de l'export" }, { status: 500 })
  }
}
