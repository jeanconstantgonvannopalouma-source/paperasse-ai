import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function maskKey(key: string | undefined): string {
  if (!key) return '❌ ABSENTE'
  if (key.length < 10) return '⚠️ TROP COURTE'
  return `✅ PRÉSENTE (${key.substring(0, 6)}...${key.substring(key.length - 4)})`
}

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  const report: Record<string, any> = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    env_variables: {
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl || '❌ ABSENTE',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: maskKey(anonKey),
      SUPABASE_SERVICE_ROLE_KEY: maskKey(serviceKey),
      GEMINI_API_KEY: maskKey(process.env.GEMINI_API_KEY),
      RESEND_API_KEY: maskKey(process.env.RESEND_API_KEY),
      STRIPE_SECRET_KEY: maskKey(process.env.STRIPE_SECRET_KEY),
    },
    tests: {
      supabase_http_ping: 'non_teste',
      supabase_service_role_auth: 'non_teste',
    }
  }

  try {
    if (supabaseUrl) {
      const pingRes = await fetch(`${supabaseUrl}/rest/v1/`, { headers: { apikey: anonKey || serviceKey } })
      report.tests.supabase_http_ping = pingRes.ok ? `✅ OK (HTTP ${pingRes.status})` : `⚠️ WARN (HTTP ${pingRes.status})`
    } else {
      report.tests.supabase_http_ping = '❌ ÉCHEC: URL Supabase absente'
    }
  } catch (err: unknown) {
    report.tests.supabase_http_ping = `❌ CRASH FETCH`
  }

  try {
    const keyToUse = serviceKey || anonKey
    if (!supabaseUrl || !keyToUse) {
      report.tests.supabase_service_role_auth = '❌ ÉCHEC: URL ou Clé absente'
    } else {
      const supabase = createServiceClient(supabaseUrl, keyToUse)
      const { error } = await supabase.from('transactions').select('id').limit(1)

      if (error) {
        report.tests.supabase_service_role_auth = `❌ ÉCHEC BDD: ${error.message}`
      } else {
        report.tests.supabase_service_role_auth = '✅ SUCCÈS (Connexion BDD OK)'
      }
    }
  } catch (err: unknown) {
    report.tests.supabase_service_role_auth = `❌ CRASH CLIENT`
  }

  return NextResponse.json(report, { status: 200 })
}