import React, { useRef, useEffect, useCallback } from 'react';
import { shouldReduceMotion } from '@/services/motionSettingsService';

interface ClickSparkProps {
  sparkColor?: string;
  sparkColors?: string[];
  sparkSize?: number;
  sparkRadius?: number;
  sparkCount?: number;
  duration?: number;
  className?: string;
  children?: React.ReactNode;
}

interface Spark {
  x: number;
  y: number;
  angle: number;
  color: string;
  startTime: number;
}

const DEFAULT_SPARK_COLORS = ['#38bdf8', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#a855f7'];

export const ClickSpark: React.FC<ClickSparkProps> = ({
  sparkColor,
  sparkColors,
  sparkSize = 12,
  sparkRadius = 24,
  sparkCount = 10,
  duration = 450,
  className = '',
  children,
}) => {
  const effectiveColors = sparkColor ? [sparkColor] : (sparkColors || DEFAULT_SPARK_COLORS);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparksRef = useRef<Spark[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  const easeOut = useCallback((t: number) => t * (2 - t), []);

  const draw = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    sparksRef.current = sparksRef.current.filter((spark) => {
      const elapsed = timestamp - spark.startTime;
      if (elapsed >= duration) return false;

      const progress = elapsed / duration;
      const eased = easeOut(progress);
      const distance = eased * sparkRadius;
      const lineLength = sparkSize * (1 - eased);

      const x1 = spark.x + distance * Math.cos(spark.angle);
      const y1 = spark.y + distance * Math.sin(spark.angle);
      const x2 = spark.x + (distance + lineLength) * Math.cos(spark.angle);
      const y2 = spark.y + (distance + lineLength) * Math.sin(spark.angle);

      ctx.save();
      ctx.strokeStyle = spark.color;
      ctx.lineWidth = 2.2 * (1 - progress);
      ctx.shadowColor = spark.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();

      return true;
    });

    if (sparksRef.current.length > 0) {
      animationFrameRef.current = requestAnimationFrame(draw);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      animationFrameRef.current = null;
    }
  }, [duration, easeOut, sparkRadius, sparkSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const resizeCanvas = () => {
      const { width, height } = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        const ctx = canvas.getContext('2d');
        ctx?.scale(dpr, dpr);
      }
    };

    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(parent);
    resizeCanvas();

    return () => {
      ro.disconnect();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (shouldReduceMotion()) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const now = performance.now();
    const newSparks: Spark[] = Array.from({ length: sparkCount }, (_, i) => ({
      x,
      y,
      angle: (2 * Math.PI * i) / sparkCount + (Math.random() * 0.4 - 0.2),
      color: effectiveColors[i % effectiveColors.length],
      startTime: now,
    }));

    sparksRef.current.push(...newSparks);

    if (!animationFrameRef.current) {
      animationFrameRef.current = requestAnimationFrame(draw);
    }
  };

  return (
    <div className={`relative ${className}`} onClick={handleClick}>
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-30" />
      {children}
    </div>
  );
};

