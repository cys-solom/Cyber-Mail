import { NextResponse } from 'next/server';

// Auth callback — في الوضع المحلي لا يوجد OAuth flow
// عند الاتصال بـ Supabase مستقبلاً، أعد تفعيل هذا الـ route
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/dashboard`);
}
