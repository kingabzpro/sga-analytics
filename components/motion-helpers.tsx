"use client";

import { useEffect, useRef, useState } from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useSpring,
  type SpringOptions,
} from "motion/react";

/**
 * Animated count-up number. Renders the rounded integer value as it tweens from
 * 0 (or a previous value) to `value` using a spring. Uses an IntersectionObserver
 * via `useInView` so the count only starts once the element scrolls into view.
 */
export function CountUp({
  value,
  duration = 1.1,
  className,
  format,
}: {
  value: number;
  duration?: number;
  className?: string;
  format?: (n: number) => string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const mv = useMotionValue(0);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const unsub = mv.on("change", (v) => setDisplay(v));
    return () => unsub();
  }, [mv]);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(mv, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
  }, [inView, value, duration, mv]);

  return (
    <span ref={ref} className={className}>
      {format ? format(display) : Math.round(display)}
    </span>
  );
}

/**
 * Circular SVG progress ring that fills on scroll-into-view. The arc length is
 * driven by a spring so it eases smoothly, and `color` can animate.
 */
export function AnimatedRing({
  value,
  size = 92,
  stroke = 8,
  color,
  trackColor = "#e2e8f0",
  children,
  spring,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color: string;
  trackColor?: string;
  children?: React.ReactNode;
  spring?: SpringOptions;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const target = c - (Math.min(100, Math.max(0, value)) / 100) * c;
  const offset = useSpring(c, {
    stiffness: 70,
    damping: 18,
    mass: 0.9,
    ...spring,
  });
  const cx = size / 2;

  useEffect(() => {
    if (inView) offset.set(target);
  }, [inView, target, offset]);

  return (
    <div ref={ref} className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
        />
        <motion.circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          style={{ strokeDashoffset: offset }}
        />
      </svg>
      {children ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** Shared entrance + stagger variants used across result cards. */
export const cardContainer = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.04 },
  },
};

export const cardItem = {
  hidden: { opacity: 0, y: 14, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 220, damping: 24 },
  },
};
