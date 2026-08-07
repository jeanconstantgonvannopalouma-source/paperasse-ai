import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create server client with service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organization_id, plan, status } = body;   // ← Corrigé

    // Validate required fields
    if (!organization_id) {
      return NextResponse.json(
        { error: 'organization_id is required' },
        { status: 400 }
      );
    }

    // Insert subscription record
    const { data, error } = await supabase
      .from('subscriptions')
      .insert({
        organization_id,                    // ← Corrigé
        plan: plan || 'free',
        status: status || 'active',
      })
      .select();

    if (error) {
      console.error('Error creating subscription:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { data: data[0] },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Unexpected error in create-subscription API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}