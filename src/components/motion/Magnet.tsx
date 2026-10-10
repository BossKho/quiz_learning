import React, { useRef, useState, useEffect } from 'react';
import { motion, useSpring } from 'motion/react';
import { shouldReduceMotion } from '@/services/motionSettingsService';

interface MagnetProps {
  children: React.ReactNode;
  padding?: number;
  strength?: number;
  className?: string;
  disabled?: boolean;
}

export const Magnet: React.FC<MagnetProps> = ({
  children,
  padding = 35,
  strength = 3.5,
  className = '',
  disabled = false,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isActive, setIsActive] = useState(false);
  const isReduced = shouldReduceMotion();

  const springConfig = { damping: 20, stiffness: 250, mass: 0.5 };
  const x = useSpring(0, springConfig);
  const y = useSpring(0, springConfig);

  useEffect(() => {
    if (disabled || isReduced) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const distX = Math.abs(e.clientX - centerX);
      const distY = Math.abs(e.clientY - centerY);

      if (distX < rect.width / 2 + padding && distY < rect.height / 2 + padding) {
        setIsActive(true);
        x.set((e.clientX - centerX) / strength);
        y.set((e.clientY - centerY) / strength);
      } else if (isActive) {
        setIsActive(false);
        x.set(0);
        y.set(0);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isActive, padding, strength, disabled, isReduced, x, y]);

  if (disabled || isReduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div ref={ref} style={{ x, y }} className={`inline-flex ${className}`}>
      {children}
    </motion.div>
  );
};

