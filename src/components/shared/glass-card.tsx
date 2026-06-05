'use client';

import { cn } from '@/lib/utils';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { ReactNode, CSSProperties } from 'react';

interface GlassCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  className?: string;
  glow?: boolean;
  hover?: boolean;
  padding?: 'sm' | 'md' | 'lg';
}

const paddingValues: Record<string, string> = { sm: '20px', md: '24px', lg: '32px' };

const baseStyle: CSSProperties = {
  background: 'rgba(255, 255, 255, 0.72)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(59,130,246,0.1)',
  borderRadius: '16px',
  boxShadow: '0 1px 6px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.02)',
  transition: 'all 0.3s ease',
};

export function GlassCard({
  children,
  className,
  glow = false,
  hover = true,
  padding = 'md',
  style,
  ...props
}: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      className={cn(glow && 'glass-glow', className)}
      style={{ ...baseStyle, padding: paddingValues[padding], ...style }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
