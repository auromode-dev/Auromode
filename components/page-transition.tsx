"use client";
import { useEffect } from "react";
import { useAnimate, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";

// Animate the existing main element without remounting forms or their state.
export function PageTransition({ children }: { children: React.ReactNode }) {
  const [scope, animate] = useAnimate();
  const path = usePathname();
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce || path.startsWith("/admin")) return;
    const playback = animate(scope.current, { opacity: [0.85, 1] }, { duration: 0.28, ease: "easeOut" });
    return () => { playback.stop(); if (scope.current) scope.current.style.opacity = "1"; };
  }, [path, reduce, animate, scope]);
  return <main ref={scope} id="main">{children}</main>;
}
