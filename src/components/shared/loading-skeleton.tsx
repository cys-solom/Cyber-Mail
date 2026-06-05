import { cn } from '@/lib/utils';

interface LoadingSkeletonProps {
  className?: string;
  lines?: number;
  variant?: 'card' | 'row' | 'text';
}

export function LoadingSkeleton({ className, lines = 3, variant = 'text' }: LoadingSkeletonProps) {
  if (variant === 'card') {
    return (
      <div className={cn('glass p-6 space-y-4', className)}>
        <div className="skeleton h-4 w-1/3" />
        <div className="skeleton h-8 w-2/3" />
        <div className="skeleton h-3 w-1/2" />
      </div>
    );
  }

  if (variant === 'row') {
    return (
      <div className={cn('flex items-center gap-4 p-4', className)}>
        <div className="skeleton h-10 w-10 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-3.5 w-3/4" />
          <div className="skeleton h-3 w-1/2" />
        </div>
        <div className="skeleton h-6 w-16 rounded-full" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton h-3.5"
          style={{ width: `${75 - i * 12}%` }}
        />
      ))}
    </div>
  );
}
