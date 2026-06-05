export const APP_NAME = 'Diaa Store — Mail Dashboard';

export const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard' },
  { label: 'Accounts', href: '/accounts', icon: 'Mail' },
  { label: 'Import', href: '/import', icon: 'Upload' },
  { label: 'Pickup', href: '/pickup', icon: 'Crosshair' },
  { label: 'Queue', href: '/queue', icon: 'ListOrdered' },
  { label: 'Logs', href: '/logs', icon: 'ScrollText', adminOnly: true },
  { label: 'Settings', href: '/settings', icon: 'Settings', adminOnly: true },
] as const;

export const ACCOUNT_STATUSES = ['active', 'inactive', 'expired', 'failed', 'cooldown'] as const;

export const STATUS_COLORS: Record<string, { bg: string; text: string; glow: string }> = {
  active:   { bg: 'bg-emerald-500/15', text: 'text-emerald-400', glow: 'shadow-emerald-500/20' },
  inactive: { bg: 'bg-gray-500/15',    text: 'text-gray-400',    glow: 'shadow-gray-500/20' },
  expired:  { bg: 'bg-amber-500/15',   text: 'text-amber-400',   glow: 'shadow-amber-500/20' },
  failed:   { bg: 'bg-red-500/15',     text: 'text-red-400',     glow: 'shadow-red-500/20' },
  cooldown: { bg: 'bg-sky-500/15',     text: 'text-sky-400',     glow: 'shadow-sky-500/20' },
  fresh:    { bg: 'bg-cyan-500/15',    text: 'text-cyan-400',    glow: 'shadow-cyan-500/20' },
  copied:   { bg: 'bg-blue-500/15',    text: 'text-blue-400',    glow: 'shadow-blue-500/20' },
  used:     { bg: 'bg-gray-500/15',    text: 'text-gray-400',    glow: 'shadow-gray-500/20' },
};

export const OTP_PATTERNS = [
  /(?:code|otp|pin|verification|verify|confirm|security)\s*(?:is|:)?\s*(\d{4,8})/i,
  /(\d{4,8})\s*(?:is your|is the)\s*(?:code|otp|pin|verification)/i,
  /(?:enter|use)\s*(?:code|otp)?\s*:?\s*(\d{4,8})/i,
  /\b(\d{6})\b/,
];
