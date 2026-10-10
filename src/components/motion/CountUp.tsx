import React, { useEffect, useRef, useCallback } from 'react';
import { useMotionValue, useSpring, useInView, useReducedMotion } from 'motion/react';
import { shouldReduceMotion } from '@/services/motionSettingsService';

interface CountUpProps {
  to: number;
  from?: number;
  duration?: number;
  separator?: string;
  className?: string;
}

export const CountUp: React.FC<CountUpProps> = ({
  to,
  from = 0,
  duration = 1.2,
  separator = '',
  className = '',
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const systemReduced = useReducedMotion();
  const isReduced = systemReduced || shouldReduceMotion();

  const motionValue = useMotionValue(isReduced ? to : from);
  const damping = 25 + 30 * (1 / Math.max(duration, 0.1));
  const stiffness = 90 * (1 / Math.max(duration, 0.1));

  const springValue = useSpring(motionValue, {
    damping,
    stiffness,
  });

  const isInView = useInView(ref, { once: true });

  const formatNumber = useCallback((val: number) => {
    const rounded = Math.round(val);
    if (!separator) return String(rounded);
    return rounded.toLocaleString('en-US').replace(/,/g, separator);
  }, [separator]);

  useEffect(() => {
    if (isReduced) {
      if (ref.current) ref.current.textContent = formatNumber(to);
      return;
    }

    if (isInView) {
      motionValue.set(to);
    }
  }, [isInView, to, isReduced, formatNumber, motionValue]);

  useEffect(() => {
    if (isReduced) return;
    const unsub = springValue.on('change', (latest) => {
      if (ref.current) {
        ref.current.textContent = formatNumber(latest);
      }
    });
    return () => unsub();
  }, [springValue, formatNumber, isReduced]);

  return (
    <span ref={ref} className={className}>
      {formatNumber(isReduced ? to : from)}
    </span>
  );
};

