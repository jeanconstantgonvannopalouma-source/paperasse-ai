import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function maskKey(key: string | undefined): string {
  if (!key) return '❌ ABSENTE'
  if (key.length < 10) return '⚠️ TROP COURTE'
  return `✅ PRÉSENTE (${key.substring(0, 6)}...${key.substring(key.length - 4)})`
}

export async function GET(request: NextRequest) {
  const report: Record<string, any> = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    env_variables: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '❌ ABSENTE',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: maskKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      SUPABASE_SERVICE_ROLE_KEY: maskKey(process.env.SUPABASE_SERVICE_ROLE_KEY),
      OPENAI_API_KEY: maskKey(process.env.OPENAI_API_KEY),
      RESEND_API_KEY: maskKey(process.env.RESEND_API_KEY),
      STRIPE_SECRET_KEY: maskKey(process.env.STRIPE_SECRET_KEY),
    },
    tests: {
      supabase_connection: 'non_teste',
      transactions_count: 0,
    }
  }

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!url || !serviceKey) {
      report.tests.supabase_connection = '❌ ÉCHEC : URL ou Clé manquante'
    } else {
      const supabase = createServiceClient(url, serviceKey)
      const { data, error, count } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })

      if (error) {
        report.tests.supabase_connection = `❌ ÉCHEC : ${error.message} (Code: ${error.code})`
      } else {
        report.tests.supabase_connection = '✅ SUCCÈS (Connexion BDD OK)'
        report.tests.transactions_count = count || 0
      }
    }
  } catch (err: unknown) {
    report.tests.supabase_connection = `❌ CRASH : ${err instanceof Error ? err.message : 'Erreur inconnue'}`
  }

  return NextResponse.json(report, { status: 200 })
}