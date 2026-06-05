import type { OTPExtraction, OTPType } from '@/types';

interface ExtractionPattern {
  regex: RegExp;
  type: OTPType;
  confidence: number;
}

const PATTERNS: ExtractionPattern[] = [
  // "Your verification code is 123456"
  { regex: /(?:verification|verify)\s*(?:code|number)\s*(?:is|:)\s*(\d{4,8})/gi, type: 'verification', confidence: 0.95 },
  // "Your OTP is 123456"
  { regex: /(?:otp|one.time.password)\s*(?:is|:)\s*(\d{4,8})/gi, type: 'otp', confidence: 0.95 },
  // "Your security code is 123456"
  { regex: /(?:security)\s*(?:code|number)\s*(?:is|:)\s*(\d{4,8})/gi, type: 'security', confidence: 0.93 },
  // "Use code 123456 to sign in"
  { regex: /(?:use|enter|input)\s*(?:code|the code|this code)\s*:?\s*(\d{4,8})/gi, type: 'otp', confidence: 0.90 },
  // "123456 is your code"
  { regex: /(\d{4,8})\s*(?:is your|is the)\s*(?:code|otp|verification|security)/gi, type: 'otp', confidence: 0.90 },
  // "Code: 123456"
  { regex: /(?:code|pin|otp)\s*:\s*(\d{4,8})/gi, type: 'otp', confidence: 0.88 },
  // "sign-in code: 123456" or "login code: 123456"
  { regex: /(?:sign.in|login|log.in|signin)\s*(?:code|pin)\s*:?\s*(\d{4,8})/gi, type: 'login', confidence: 0.92 },
  // "two-factor" or "2FA" patterns
  { regex: /(?:2fa|two.factor|multi.factor)\s*(?:code|token)\s*:?\s*(\d{4,8})/gi, type: '2fa', confidence: 0.90 },
  // Fallback: any 6-digit number that looks like a code (lower confidence)
  { regex: /\b(\d{6})\b/g, type: 'otp', confidence: 0.40 },
];

/**
 * Extract OTP codes from email subject + body text.
 * Returns sorted by confidence (highest first), deduplicated.
 */
export function extractOTP(subject: string, body: string): OTPExtraction[] {
  const text = `${subject} ${body}`;
  const results: OTPExtraction[] = [];
  const seenCodes = new Set<string>();

  for (const pattern of PATTERNS) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const code = match[1];
      if (code && !seenCodes.has(code)) {
        seenCodes.add(code);
        results.push({
          code,
          type: pattern.type,
          confidence: pattern.confidence,
        });
      }
    }
  }

  // Sort by confidence descending
  return results.sort((a, b) => b.confidence - a.confidence);
}
