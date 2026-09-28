"use client";
import { motion, useReducedMotion } from "framer-motion";
export function Reveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 1, y: 0 }}
      whileInView={reduce ? {} : { opacity: [0.5, 1], y: [18, 0] }}
      viewport={{ once: true, amount: 0.08 }}
      transition={{ duration: 0.65, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
