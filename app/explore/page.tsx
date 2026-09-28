import { PageHero } from "@/components/page-hero";
import { photos } from "@/lib/content";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
export const metadata = {
  title: "Explore Auroville",
  alternates: { canonical: "/explore" },
};
export default function Explore() {
  return (
    <>
      <PageHero
        eyebrow="CURIOSITY LOOKS GOOD ON YOU"
        title="Take the path less hurried."
        text="Find your own rhythm in Auroville. Leave a little space for the unexpected."
        image={photos.auroville}
      />
      <section className="section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">A DIFFERENT KIND OF DESTINATION</span>
            <h2>
              Go slowly.
              <br />
              <em>Look a little closer.</em>
            </h2>
          </div>
          <p>
            Ask reception for local guidance,
            <br />
            current access information, and directions.
          </p>
        </div>
        <div className="location-grid">
          {[
            [
              "01",
              "Matrimandir & its surroundings",
              "Discover one of Auroville’s most recognisable landmarks. Check the official visitor arrangements before you go.",
              "https://auroville.org",
            ],
            [
              "02",
              "Creative encounters",
              "Ask about local workshops, makers, and community spaces. Find a new perspective in the work of someone else’s hands.",
              "/contact",
            ],
            [
              "03",
              "A slower outdoors",
              "Explore leafy lanes and the surrounding landscape. Reception can help you plan a route suited to your time and interests.",
              "/contact",
            ],
          ].map(([n, t, d, u]) => (
            <article key={n}>
              <span className="eyebrow">{n} / DISCOVER</span>
              <h3>{t}</h3>
              <p>{d}</p>
              <a className="text-link" href={u}>
                Plan your visit <ArrowUpRight size={15} />
              </a>
            </article>
          ))}
        </div>
        <iframe
          className="contact-map"
          title="Find Auromode in Auroville"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          src="https://maps.google.com/maps?q=Auromode%20Auroville&t=&z=14&ie=UTF8&iwloc=&output=embed"
        />
        <Link className="text-link" href="/contact">
          Let us help you explore <ArrowUpRight size={16} />
        </Link>
      </section>
    </>
  );
}
