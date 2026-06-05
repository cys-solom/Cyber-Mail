'use client';

import { motion } from 'framer-motion';
import { Inbox } from 'lucide-react';
import { GradientButton } from './gradient-button';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, description, icon, actionLabel, onAction }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-16 px-8 text-center"
    >
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
        style={{
          background: 'rgba(37,99,235,0.06)',
          border: '1px solid rgba(37,99,235,0.1)',
        }}>
        {icon ?? <Inbox className="w-10 h-10 text-blue-400" />}
      </div>
      <h3 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 8 }}>{title}</h3>
      <p style={{ fontSize: 14, color: '#94a3b8', maxWidth: 384, marginBottom: 24 }}>{description}</p>
      {actionLabel && onAction && (
        <GradientButton onClick={onAction} size="sm">
          {actionLabel}
        </GradientButton>
      )}
    </motion.div>
  );
}
