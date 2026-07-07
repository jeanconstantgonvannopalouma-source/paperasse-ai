import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Ce middleware ne fait rien, il laisse juste passer la requête
  // pour que vous puissiez voir votre page d'inscription.
  return NextResponse.next();
}