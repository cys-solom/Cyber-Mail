import { NextRequest, NextResponse } from 'next/server';
import { encrypt } from '@/lib/crypto';
import { verifyAdminSession } from '@/lib/auth';
import { accountsStore } from '@/lib/local-store';

// GET — Get single account
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const data = await accountsStore.findById(id);
  if (!data) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true, data });
}

// PATCH — Update account
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const patch: Record<string, unknown> = {};

  if (body.status)              patch.status = body.status;
  if (body.notes !== undefined) patch.notes = body.notes;
  if (body.assigned_to !== undefined) patch.assigned_to = body.assigned_to;
  if (body.health_score !== undefined) patch.health_score = body.health_score;
  if (body.password)            patch.encrypted_password = encrypt(body.password);
  if (body.refresh_token)       patch.encrypted_refresh_token = encrypt(body.refresh_token);
  if (body.client_id)           patch.client_id = body.client_id;

  const data = await accountsStore.update(id, patch);
  if (!data) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true, data });
}

// DELETE — Delete account
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const ok = await accountsStore.delete(id);
  if (!ok) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
