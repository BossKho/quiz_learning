import React from 'react';
import { cn } from '@/lib/utils';
import { useReducedMotion } from 'motion/react';
import { shouldReduceMotion } from '@/services/motionSettingsService';

interface ShinyTextProps {
  text: string;
  className?: string;
  shimmerColor?: string;
}

export const ShinyText: React.FC<ShinyTextProps> = ({
  text,
  className = '',
  shimmerColor = 'rgba(255, 255, 255, 0.8)',
}) => {
  const systemReduced = useReducedMotion();
  const isReduced = systemReduced || shouldReduceMotion();

  if (isReduced) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span
      className={cn(
        'inline-block bg-clip-text text-transparent bg-[linear-gradient(110deg,currentColor_35%,var(--shimmer-color)_50%,currentColor_65%)] bg-[length:250%_100%] animate-[shimmer_3s_infinite_linear]',
        className
      )}
      style={{
        '--shimmer-color': shimmerColor,
      } as React.CSSProperties}
    >
      {text}
    </span>
  );
};

