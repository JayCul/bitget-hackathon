"use client";
import { motion, useReducedMotion } from "framer-motion";

/** One faint radial glow drifting slowly behind the page. */
export function AmbientGlow({ tone = "warm" }: { tone?: "warm" | "cool" }) {
  const reduce = useReducedMotion();
  const color = tone === "warm" ? "rgba(232,163,74,0.07)" : "rgba(125,138,150,0.07)";
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <motion.div
        className="absolute size-[900px] rounded-full"
        style={{ background: `radial-gradient(circle, ${color} 0%, transparent 60%)`, left: "20%", top: "-30%" }}
        animate={reduce ? undefined : { x: [0, 120, -60, 0], y: [0, 80, 140, 0] }}
        transition={{ duration: 48, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
