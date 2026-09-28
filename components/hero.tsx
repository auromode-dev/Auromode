"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  MapPin,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { photos } from "@/lib/content";
const slides = [
  {
    image: photos.hero,
    alt: "Auromode guesthouse surrounded by trees in Auroville",
  },
  {
    image: photos.garden,
    alt: "The tree-shaded entrance to the Auromode campus",
  },
  { image: photos.room, alt: "A restful room filled with natural light" },
];
export function Hero() {
  const [index, setIndex] = useState(0);
  return (
    <section className="hero">
      <img
        className="hero-image"
        src={slides[index].image}
        alt={slides[index].alt}
        fetchPriority="high"
      />
      <div className="hero-shade" />
      <div className="hero-content">
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
      </div>
      <div className="hero-bottom">
        <span>
          <MapPin size={14} /> AUROVILLE, TAMIL NADU, INDIA
        </span>
        <a href="#welcome">
          SLOW DOWN. SCROLL ON. <ArrowDown size={16} />
        </a>
        <div className="hero-index" aria-label="Photo carousel">
          <button
            type="button"
            aria-label="Previous photo"
            onClick={() => setIndex((index + 2) % 3)}
          >
            <ChevronLeft size={17} />
          </button>
          <span aria-live="polite">0{index + 1}</span>
          <i />
          <span>03</span>
          <button
            type="button"
            aria-label="Next photo"
            onClick={() => setIndex((index + 1) % 3)}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
      <span className="hero-side">
        STAY &nbsp; / &nbsp; WORK &nbsp; / &nbsp; EAT &nbsp; / &nbsp; CONNECT
      </span>
    </section>
  );
}
