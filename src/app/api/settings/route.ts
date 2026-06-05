import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth';
import { settingsStore } from '@/lib/local-store';

export async function GET() {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const data = settingsStore.findAll();
  return NextResponse.json({ success: true, data });
}

export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { key, value } = body;

  if (!key || value === undefined) {
    return NextResponse.json({ success: false, error: 'key and value required' }, { status: 400 });
  }

  const data = settingsStore.upsert(key, value);
  return NextResponse.json({ success: true, data });
}
