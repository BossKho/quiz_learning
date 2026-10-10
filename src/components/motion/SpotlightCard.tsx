import React, { useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useReducedMotion } from 'motion/react';
import { shouldReduceMotion } from '@/services/motionSettingsService';

interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  spotlightColor?: string;
  className?: string;
  children: React.ReactNode;
}

export const SpotlightCard: React.FC<SpotlightCardProps> = ({
  spotlightColor,
  className,
  children,
  ...props
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const systemReduced = useReducedMotion();
  const isReduced = systemReduced || shouldReduceMotion();

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isReduced || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setPosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, [isReduced]);

  const handleMouseEnter = useCallback(() => {
    if (!isReduced) setOpacity(1);
  }, [isReduced]);

  const handleMouseLeave = useCallback(() => {
    setOpacity(0);
  }, []);

  const defaultSpotlight = spotlightColor || 'rgba(59, 130, 246, 0.12)';

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border bg-card transition-all duration-200',
        className
      )}
      {...props}
    >
      {!isReduced && (
        <div
          className="pointer-events-none absolute -inset-px transition-opacity duration-300"
          style={{
            opacity,
            background: `radial-gradient(400px circle at ${position.x}px ${position.y}px, ${defaultSpotlight}, transparent 70%)`,
          }}
          aria-hidden="true"
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
};

