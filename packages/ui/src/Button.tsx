"use client";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from "react";

type Props = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd"
> & {
  variant?: "primary" | "ghost";
  children: ReactNode;
};

/** Primary (amber) or ghost. Subtle magnetic hover, border glow on hover and focus. */
export function Button({ variant = "primary", className = "", children, ...rest }: Props) {
  const reduce = useReducedMotion();
  const x = useSpring(useMotionValue(0), { stiffness: 300, damping: 20 });
  const y = useSpring(useMotionValue(0), { stiffness: 300, damping: 20 });

  function onMove(e: MouseEvent<HTMLButtonElement>) {
    if (reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    x.set(((e.clientX - r.left) / r.width - 0.5) * 6);
    y.set(((e.clientY - r.top) / r.height - 0.5) * 6);
  }
  function onLeave() {
    x.set(0);
    y.set(0);
  }

  const base =
    "relative inline-flex items-center justify-center gap-2 rounded-md px-5 h-11 text-[15px] font-medium transition-[box-shadow,background-color,border-color,opacity] duration-200 disabled:opacity-40 disabled:pointer-events-none";
  const styles =
    variant === "primary"
      ? "bg-accent text-black hover:shadow-[0_0_0_1px_var(--color-accent),0_0_24px_-4px_var(--color-accent)]"
      : "border border-line-strong text-fg hover:border-accent/60 hover:shadow-[0_0_20px_-8px_var(--color-accent)]";

  return (
    <motion.button
      style={{ x, y }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`${base} ${styles} ${className}`}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
