import React, { useState, useEffect, useRef, useCallback } from 'react';
import { shouldReduceMotion } from '@/services/motionSettingsService';

interface DecryptedTextProps {
  text: string;
  speed?: number;
  maxIterations?: number;
  className?: string;
  animateOn?: 'mount' | 'hover';
}

const GLYPHS = '0123456789ABCDEF!@#$%&*?';

export const DecryptedText: React.FC<DecryptedTextProps> = ({
  text,
  speed = 40,
  maxIterations = 8,
  className = '',
  animateOn = 'mount',
}) => {
  const [displayText, setDisplayText] = useState(text);
  const isReduced = shouldReduceMotion();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const triggerAnimation = useCallback(() => {
    if (isReduced) {
      setDisplayText(text);
      return;
    }

    let iteration = 0;
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      setDisplayText(() => {
        return text
          .split('')
          .map((char, index) => {
            if (char === ' ') return ' ';
            if (index < iteration / (maxIterations / text.length)) {
              return text[index];
            }
            return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          })
          .join('');
      });

      iteration += 1;
      if (iteration > maxIterations + text.length) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setDisplayText(text);
      }
    }, speed);
  }, [text, speed, maxIterations, isReduced]);

  useEffect(() => {
    if (animateOn === 'mount') {
      triggerAnimation();
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [triggerAnimation, animateOn]);

  const handleMouseEnter = () => {
    if (animateOn === 'hover') {
      triggerAnimation();
    }
  };

  return (
    <span className={`font-mono ${className}`} onMouseEnter={handleMouseEnter}>
      {displayText}
    </span>
  );
};

