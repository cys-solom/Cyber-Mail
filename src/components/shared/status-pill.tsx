'use client';

import { cn } from '@/lib/utils';
import { STATUS_COLORS } from '@/lib/constants';

interface StatusPillProps {
  status: string;
  className?: string;
}

export function StatusPill({ status, className }: StatusPillProps) {
  const colors = STATUS_COLORS[status] ?? STATUS_COLORS.inactive;

  return (
    <span
      className={cn(
        'pill',
        colors.bg,
        colors.text,
        `shadow-sm ${colors.glow}`,
        className
      )}
    >
      {status}
    </span>
  );
}
