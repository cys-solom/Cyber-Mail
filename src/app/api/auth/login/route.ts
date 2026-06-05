import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSessionToken, verifyAdminSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { password } = body;

  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  if (password !== adminPassword) {
    return NextResponse.json({ success: false, error: 'Wrong password' }, { status: 401 });
  }

  // Create stateless HMAC token — survives server restarts
  const sessionToken = createSessionToken(adminPassword);

  const cookieStore = await cookies();
  cookieStore.set('admin_session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 365 * 24 * 60 * 60, // 1 year
  });

  cookieStore.set('is_logged_in', '1', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 365 * 24 * 60 * 60,
  });

  return NextResponse.json({ success: true });
}

// Verify session (GET)
export async function GET() {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) return NextResponse.json({ success: false, error: 'No session' }, { status: 401 });
  return NextResponse.json({ success: true });
}

// Logout (DELETE)
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete('admin_session');
  cookieStore.delete('is_logged_in');
  return NextResponse.json({ success: true });
}
