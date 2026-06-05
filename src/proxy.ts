import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Simple proxy that handles auth redirects
// Supabase session check happens client-side to avoid build-time issues
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Root redirect
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
