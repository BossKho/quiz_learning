import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';
import { shouldReduceMotion } from '@/services/motionSettingsService';

interface TiltedCardProps {
  children: React.ReactNode;
  className?: string;
  maxRotate?: number;
  scaleOnHover?: number;
  glareOpacity?: number;
  onClick?: () => void;
}

export const TiltedCard: React.FC<TiltedCardProps> = ({
  children,
  className = '',
  maxRotate = 10,
  scaleOnHover = 1.02,
  glareOpacity = 0.2,
  onClick,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const isReduced = shouldReduceMotion();

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);

  const springConfig = { damping: 25, stiffness: 220, mass: 0.8 };
  const rotateX = useSpring(rawX, springConfig);
  const rotateY = useSpring(rawY, springConfig);
  const scale = useSpring(1, springConfig);

  const [glarePos, setGlarePos] = useState({ x: 50, y: 50, opacity: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isReduced || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const xPct = (mouseX / width - 0.5) * 2;
    const yPct = (mouseY / height - 0.5) * 2;

    rawX.set(-yPct * maxRotate);
    rawY.set(xPct * maxRotate);

    setGlarePos({
      x: (mouseX / width) * 100,
      y: (mouseY / height) * 100,
      opacity: glareOpacity,
    });
  };

  const handleMouseEnter = () => {
    if (isReduced) return;
    scale.set(scaleOnHover);
  };

  const handleMouseLeave = () => {
    if (isReduced) return;
    rawX.set(0);
    rawY.set(0);
    scale.set(1);
    setGlarePos((prev) => ({ ...prev, opacity: 0 }));
  };

  if (isReduced) {
    return (
      <div className={`relative ${className}`} onClick={onClick}>
        {children}
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className="perspective-1000 w-full h-full"
    >
      <motion.div
        style={{
          rotateX,
          rotateY,
          scale,
          transformStyle: 'preserve-3d',
        }}
        className={`relative w-full h-full ${className}`}
      >
        {children}

        {/* Dynamic Specular Glare Overlay */}
        <div
          className="absolute inset-0 rounded-inherit pointer-events-none transition-opacity duration-300 z-20"
          style={{
            opacity: glarePos.opacity,
            background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.06) 40%, transparent 75%)`,
          }}
        />
      </motion.div>
    </div>
  );
};

