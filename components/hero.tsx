"use client";
import { MotionLink as Link, MotionButton } from "@/components/motion-controls";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  MapPin,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
const slides = [
  {
    image: "/slide01.webp",
    alt: "The tree-shaded entrance to the Auromode campus",
  },
  {
    image: "/slide02.webp",
    alt: "The tree-shaded entrance to the Auromode campus",
  },
  { image: "/slide03.webp", alt: "Tree-shaded courtyard at Auromode" },
];
export function Hero() {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  function changeSlide(step: number) {
    setDirection(step);
    setIndex((current) => (current + step + slides.length) % slides.length);
  }
  return (
    <section className="hero">
      <AnimatePresence initial={false} custom={direction}>
        <motion.img
          key={index}
          custom={direction}
          variants={{
            enter: (step: number) => ({ x: reduce ? 0 : `${step * 100}%` }),
            center: { x: 0 },
            exit: (step: number) => ({ x: reduce ? 0 : `${step * -100}%` }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: reduce ? 0 : 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="hero-image"
          src={slides[index].image}
          alt={slides[index].alt}
          fetchPriority="high"
        />
      </AnimatePresence>
      <div className="hero-shade" />
      <motion.div
        className="hero-content"
        initial={false}
        animate={
          reduce ? { y: 0, opacity: 1 } : { y: [12, 0], opacity: [0.8, 1] }
        }
        transition={{ duration: 0.65, ease: "easeOut" }}
      >
        <div className="hero-eyebrow">
          <span /> ROOTED IN AUROVILLE. OPEN TO YOU.
        </div>
        <h1>
          A place to stay.
          <br />A way to <em>be.</em>
        </h1>
        <p>
          Stay a little. Discover a lot.
          <br />
          Find your rhythm in the heart of Auroville.
        </p>
        <Link href="/guesthouse" className="button button-ivory">
          Discover your stay <ArrowUpRight size={18} />
        </Link>
      </motion.div>
      <div className="hero-bottom">
        <span>
          <MapPin size={14} /> AUROVILLE, TAMIL NADU, INDIA
        </span>
        <a href="#welcome">
          SLOW DOWN. SCROLL ON. <ArrowDown size={16} />
        </a>
        <div className="hero-index" aria-label="Photo carousel">
          <MotionButton
            type="button"
            aria-label="Previous photo"
            onClick={() => changeSlide(-1)}
          >
            <ChevronLeft size={17} />
          </MotionButton>
          <span aria-live="polite">0{index + 1}</span>
          <i />
          <span>03</span>
          <MotionButton
            type="button"
            aria-label="Next photo"
            onClick={() => changeSlide(1)}
          >
            <ChevronRight size={17} />
          </MotionButton>
        </div>
      </div>
      <span className="hero-side">
        STAY &nbsp; / &nbsp; WORK &nbsp; / &nbsp; EAT &nbsp; / &nbsp; CONNECT
      </span>
    </section>
  );
}
