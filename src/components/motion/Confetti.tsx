import React, { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import { shouldReduceMotion } from '@/services/motionSettingsService';

interface ConfettiProps {
  durationMs?: number;
  particleCount?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  vRot: number;
  alpha: number;
}

const CONFETTI_COLORS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // purple
  '#06b6d4', // cyan
];

export const Confetti: React.FC<ConfettiProps> = ({
  durationMs = 2800,
  particleCount = 70,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const systemReduced = useReducedMotion();
  const isReduced = systemReduced || shouldReduceMotion();

  useEffect(() => {
    if (isReduced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const particles: Particle[] = [];

    // Left cannon
    for (let i = 0; i < particleCount / 2; i++) {
      particles.push({
        x: width * 0.1,
        y: height * 0.9,
        vx: Math.random() * 8 + 3,
        vy: -(Math.random() * 12 + 8),
        size: Math.random() * 8 + 5,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 10,
        alpha: 1,
      });
    }

    // Right cannon
    for (let i = 0; i < particleCount / 2; i++) {
      particles.push({
        x: width * 0.9,
        y: height * 0.9,
        vx: -(Math.random() * 8 + 3),
        vy: -(Math.random() * 12 + 8),
        size: Math.random() * 8 + 5,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 10,
        alpha: 1,
      });
    }

    let animationId: number;
    const startTime = performance.now();

    const render = (time: number) => {
      const elapsed = time - startTime;
      ctx.clearRect(0, 0, width, height);

      const fadeProgress = Math.max(0, (elapsed - durationMs * 0.6) / (durationMs * 0.4));

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.35; // gravity
        p.vx *= 0.98; // air drag
        p.rotation += p.vRot;
        p.alpha = Math.max(0, 1 - fadeProgress);

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }

      if (elapsed < durationMs) {
        animationId = requestAnimationFrame(render);
      }
    };

    animationId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
    };
  }, [durationMs, particleCount, isReduced]);

  if (isReduced) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-50 size-full"
      aria-hidden="true"
    />
  );
};

