import { NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth';
import { logsStore } from '@/lib/local-store';

export async function GET() {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const data = logsStore.findAll(100);
  return NextResponse.json({ success: true, data });
}
