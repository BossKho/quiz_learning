import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { shouldReduceMotion } from '@/services/motionSettingsService';

interface MotionViewProps {
  children: React.ReactNode;
  className?: string;
}

export const MotionView: React.FC<MotionViewProps> = ({ children, className = '' }) => {
  const systemReduced = useReducedMotion();
  const isReduced = systemReduced || shouldReduceMotion();

  if (isReduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

