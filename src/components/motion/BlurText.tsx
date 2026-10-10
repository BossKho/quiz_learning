import React from 'react';
import { motion } from 'motion/react';
import { shouldReduceMotion } from '@/services/motionSettingsService';

interface BlurTextProps {
  text: string;
  className?: string;
  staggerDelay?: number;
}

export const BlurText: React.FC<BlurTextProps> = ({
  text,
  className = '',
  staggerDelay = 0.018,
}) => {
  const isReduced = shouldReduceMotion();

  if (isReduced) {
    return <span className={className}>{text}</span>;
  }

  const words = text.split(' ');

  return (
    <span className={`inline-block ${className}`}>
      {words.map((word, idx) => (
        <motion.span
          key={`${word}-${idx}`}
          initial={{ filter: 'blur(8px)', opacity: 0, y: 3 }}
          animate={{ filter: 'blur(0px)', opacity: 1, y: 0 }}
          transition={{
            duration: 0.18,
            delay: Math.min(idx * staggerDelay, 0.25),
            ease: 'easeOut',
          }}
          className="inline-block mr-[0.28em] will-change-transform"
        >
          {word}
        </motion.span>
      ))}
    </span>
  );
};

