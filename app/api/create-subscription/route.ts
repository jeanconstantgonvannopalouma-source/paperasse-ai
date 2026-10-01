import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    return NextResponse.json({ success: true, message: 'Abonnement initialisé' })
  } catch (error: unknown) {
    return NextResponse.json({ error: 'Erreur abonnements' }, { status: 500 })
  }
}