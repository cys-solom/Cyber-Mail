import { NextRequest, NextResponse } from 'next/server';
import { extractOTP } from '@/lib/otp-extractor';
import { verifyAdminSession } from '@/lib/auth';
import { messagesStore, otpStore } from '@/lib/local-store';

export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { message_id } = body;

  if (!message_id) {
    return NextResponse.json({ success: false, error: 'message_id required' }, { status: 400 });
  }

  const message = messagesStore.findById(message_id);
  if (!message) {
    return NextResponse.json({ success: false, error: 'Message not found' }, { status: 404 });
  }

  const extractions = extractOTP(message.subject || '', message.raw_body || message.body_preview || '');

  if (extractions.length === 0) {
    return NextResponse.json({ success: true, data: { otps: [], message: 'No OTP codes found' } });
  }

  const otps = [];
  for (const ext of extractions) {
    const existing = otpStore.findByMessageAndCode(message_id, ext.code);
    if (!existing) {
      const otpData = otpStore.insert({
        message_id,
        account_id: message.account_id,
        code: ext.code,
        code_type: ext.type,
        sender: message.sender,
        subject: message.subject,
      });
      otps.push(otpData);
    }
  }

  if (otps.length > 0) {
    messagesStore.update(message_id, { has_otp: true });
  }

  return NextResponse.json({ success: true, data: { otps } });
}
