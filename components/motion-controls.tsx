"use client";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { ComponentProps } from "react";

const AnimatedLink = motion.create(Link);
export function MotionLink(props: ComponentProps<typeof AnimatedLink>) {
  const reduce = useReducedMotion();
  return <AnimatedLink whileHover={reduce ? undefined : { y: -2 }} whileTap={reduce ? undefined : { scale: 0.98 }} transition={{ type: "spring", stiffness: 380, damping: 28 }} {...props} />;
}
export function MotionButton(props: ComponentProps<typeof motion.button>) {
  const reduce = useReducedMotion();
  return <motion.button whileHover={reduce || props.disabled ? undefined : { y: -2 }} whileTap={reduce || props.disabled ? undefined : { scale: 0.96 }} transition={{ type: "spring", stiffness: 380, damping: 28 }} {...props} />;
}
