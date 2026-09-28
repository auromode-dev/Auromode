import { Hero } from "@/components/hero";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUpRight,
  Leaf,
  MapPin,
  Wifi,
  Coffee,
  Sun,
  Heart,
  MoveUpRight,
} from "lucide-react";
import { AvailabilitySearch } from "@/components/availability-search";
import { Reveal } from "@/components/reveal";
import { experiences, photos } from "@/lib/content";
export const metadata = {
  alternates: { canonical: "/", languages: { en: "/", fr: "/fr", ta: "/ta" } },
};
export default function Home() {
  return (
    <>
      <Hero />
      <div className="search-wrap">
        <AvailabilitySearch />
      </div>
      <section className="intro section" id="welcome">
        <Reveal className="intro-copy">
          <span className="eyebrow">
            <span className="tiny-leaf">✳</span> MORE THAN A DESTINATION
          </span>
          <h2>
            Come for a stay.
            <br />
            Find a sense of <em>belonging.</em>
          </h2>
          <p>
            Some places invite you to visit. Others invite you to become a part
            of them.
          </p>
          <p>
            Set amidst the green heart of Auroville, Auromode is a place for
            curious travellers, thoughtful creators, and everyday explorers. A
            comfortable room, an inspiring workspace, a shared meal — a world of
            little connections.
          </p>
          <Link className="text-link" href="/about">
            The story of Auromode <ArrowUpRight size={18} />
          </Link>
          <div className="intro-signoff">
            <Leaf size={18} />
            <span>Rooted in community. Growing since 1975.</span>
          </div>
        </Reveal>
        <Reveal className="intro-images">
          <img
            className="intro-main"
            src={photos.garden}
            alt="Quiet retreat surrounded by tropical greenery"
            loading="lazy"
          />
          <div className="story-stamp">
            <span>EST.</span>
            <strong>1975</strong>
            <span>GROWING TOGETHER</span>
          </div>
          <div className="intro-caption">
            <span>Less rush. More life.</span>
            <span>That’s the Auromode way.</span>
          </div>
        </Reveal>
      </section>
      <section className="ecosystem section">
        <Reveal className="section-heading">
          <div>
            <span className="eyebrow">ONE CAMPUS. MANY POSSIBILITIES.</span>
            <h2>
              Make room for <em>more.</em>
            </h2>
          </div>
          <p>
            Stay, create, gather, explore.
            <br />
            Life finds its own balance here.
          </p>
        </Reveal>
        <div className="experience-grid">
          {experiences.map((x) => (
            <Reveal key={x.n}>
              <Link href={x.href} className="experience-card">
                <div className="experience-image">
                  <img src={x.image} alt={x.name} loading="lazy" />
                  <span className="card-tag">{x.tag}</span>
                  <span className="round-arrow">
                    <ArrowUpRight size={19} />
                  </span>
                </div>
                <div className="card-heading">
                  <h3>{x.name}</h3>
                  <span>{x.n}</span>
                </div>
                <p>{x.text}</p>
                <span className="card-link">
                  {x.tag === "STAY"
                    ? "Find your room"
                    : x.tag === "WORK"
                      ? "Find your flow"
                      : x.tag === "EAT"
                        ? "Pull up a chair"
                        : "Explore the collection"}{" "}
                  <ArrowUpRight size={14} />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>
      <section className="benefits">
        <div className="benefits-inner">
          <div>
            <span className="eyebrow">
              THE LITTLE THINGS, THOUGHTFULLY DONE
            </span>
            <h2>
              Everything you need.
              <br />
              <em>Space for what matters.</em>
            </h2>
          </div>
          <div className="benefit-grid">
            {[
              [MapPin, "In the heart of Auroville"],
              [Wifi, "WiFi that keeps up"],
              [Coffee, "Good food, close by"],
              [Sun, "Room to slow down"],
              [Leaf, "Nature all around"],
              [Heart, "A community to belong to"],
            ].map(([Icon, label], i) => {
              const Component = Icon as typeof Leaf;
              return (
                <div key={i}>
                  <Component size={24} strokeWidth={1.3} />
                  <span>{label as string}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <section className="explore-preview section">
        <Reveal className="explore-photo">
          <img
            src={photos.auroville}
            alt="Sunlight falling across a lush landscape in southern India"
            loading="lazy"
          />
          <span className="photo-label">
            WANDER A LITTLE. DISCOVER SOMETHING.
          </span>
        </Reveal>
        <Reveal className="explore-copy">
          <span className="eyebrow">BEYOND YOUR ROOM</span>
          <h2>
            A different
            <br />
            kind of <em>everyday.</em>
          </h2>
          <p>
            Cycle down red-earth paths. Discover a local workshop. Make time for
            a quiet moment, or a conversation that stays with you.
          </p>
          <p>
            There’s no single way to experience Auroville.
            <br />
            There’s just your way.
          </p>
          <Link href="/explore" className="text-link">
            Get to know Auroville <ArrowUpRight size={18} />
          </Link>
        </Reveal>
      </section>
      <section className="philosophy">
        <Leaf size={30} strokeWidth={1} />
        <span className="eyebrow">THE SPIRIT OF AUROMODE</span>
        <blockquote>
          “The best part of a journey is finding
          <br />a place where you can simply <em>be yourself.</em>”
        </blockquote>
        <span className="philosophy-signature">
          A slower pace. A deeper connection.
        </span>
      </section>
      <section className="cta-banner">
        <div>
          <span className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span>
          <h2>
            Come as you are.
            <br />
            <em>Stay a little longer.</em>
          </h2>
        </div>
        <div>
          <Link href="/book" className="button button-ivory">
            Let’s plan your stay <ArrowUpRight size={18} />
          </Link>
          <span>
            Have a question?{" "}
            <a href="https://wa.me/917871562343">Say hello on WhatsApp</a>
          </span>
        </div>
        <span className="cta-flower">✳</span>
      </section>
    </>
  );
}
