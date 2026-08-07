import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create server client with service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Parse JSON body
    const body = await request.json();

    // Extract company data
    const { name, email, phone, address, ...extra } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      );
    }

    // Insert company into organizations table
    const { data, error } = await supabase
      .from('organizations')
      .insert({
        name,
        email,
        phone,
        address,
        ...extra,
      })
      .select();

    if (error) {
      console.error('Error creating company:', error);
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
    console.error('Unexpected error in create-company API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Optional: Add GET method for fetching companies
export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}