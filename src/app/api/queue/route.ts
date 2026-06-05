import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth';
import { queueStore } from '@/lib/local-store';

export async function GET() {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const data = queueStore.findAll();
  return NextResponse.json({ success: true, data });
}

export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { action, session_id } = body;

  if (action === 'start') {
    const data = queueStore.insert();
    return NextResponse.json({ success: true, data });
  }

  if (!session_id) {
    return NextResponse.json({ success: false, error: 'session_id required' }, { status: 400 });
  }

  if (action === 'pause') {
    queueStore.update(session_id, { status: 'paused' });
  } else if (action === 'resume') {
    queueStore.update(session_id, { status: 'active' });
  } else if (action === 'stop') {
    queueStore.update(session_id, { status: 'completed', ended_at: new Date().toISOString() });
  }

  return NextResponse.json({ success: true });
}
