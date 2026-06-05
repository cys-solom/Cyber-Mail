'use client';

import { cn } from '@/lib/utils';
import { CSSProperties, ReactNode } from 'react';

interface GradientButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function GradientButton({
  children,
  className,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  style: userStyle,
  ...props
}: GradientButtonProps) {
  const sizeMap: Record<string, CSSProperties> = {
    sm: { padding: '10px 22px', fontSize: 14, borderRadius: 12, gap: 8 },
    md: { padding: '14px 28px', fontSize: 15, borderRadius: 14, gap: 10 },
    lg: { padding: '16px 36px', fontSize: 16, borderRadius: 16, gap: 12 },
  };

  const variantMap: Record<string, CSSProperties> = {
    primary: {
      background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
      color: 'white',
      border: 'none',
      boxShadow: '0 4px 16px rgba(37,99,235,0.2)',
    },
    secondary: {
      background: 'rgba(59,130,246,0.06)',
      color: '#475569',
      border: '1px solid rgba(59,130,246,0.12)',
      boxShadow: 'none',
    },
    danger: {
      background: 'linear-gradient(135deg, #ef4444, #f43f5e)',
      color: 'white',
      border: 'none',
      boxShadow: '0 4px 16px rgba(239,68,68,0.25)',
    },
  };

  return (
    <button
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        transition: 'all 0.25s ease',
        opacity: disabled || loading ? 0.4 : 1,
        whiteSpace: 'nowrap',
        ...sizeMap[size],
        ...variantMap[variant],
        ...userStyle,
      }}
      disabled={disabled || loading}
      onMouseEnter={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          if (variant === 'primary') e.currentTarget.style.boxShadow = '0 8px 24px rgba(37,99,235,0.3)';
          if (variant === 'danger') e.currentTarget.style.boxShadow = '0 8px 24px rgba(239,68,68,0.35)';
          if (variant === 'secondary') e.currentTarget.style.background = 'rgba(59,130,246,0.1)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = variantMap[variant].boxShadow as string;
        if (variant === 'secondary') e.currentTarget.style.background = 'rgba(59,130,246,0.06)';
      }}
      className={className}
      {...props}
    >
      {loading && (
        <svg className="animate-spin" style={{ width: 18, height: 18 }} viewBox="0 0 24 24">
          <circle style={{ opacity: 0.2 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path style={{ opacity: 0.8 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
