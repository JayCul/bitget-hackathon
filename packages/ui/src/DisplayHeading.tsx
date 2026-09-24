"use client";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

type Props = {
  lines: ReactNode[];
  as?: "h1" | "h2";
  size?: "display" | "title";
  className?: string;
};

/** Large editorial heading. Each line fades in with a 12px rise, staggered 70ms. */
export function DisplayHeading({ lines, as = "h1", size = "display", className = "" }: Props) {
  const reduce = useReducedMotion();
  const Tag = as;
  return (
    <Tag className={`font-medium ${size === "display" ? "text-display" : "text-title"} ${className}`}>
      {lines.map((line, i) => (
        <motion.span
          key={i}
          className="block"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
        >
          {line}
        </motion.span>
      ))}
    </Tag>
  );
}
