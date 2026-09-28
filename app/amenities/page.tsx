import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { experiences, photos } from "@/lib/content";
export const metadata = {
  title: "Life on Campus",
  alternates: { canonical: "/amenities" },
};
export default function Amenities() {
  return (
    <>
      <PageHero
        eyebrow="STAY. WORK. EAT. CONNECT."
        title="One campus. Your kind of everyday."
        text="A little work, a shared meal, something unexpected. Discover the places that make Auromode feel like a community."
        image={photos.work}
      />
      <section className="section">
        <div className="room-grid">
          {experiences.slice(1).map((x) => (
            <article className="room-card" key={x.n}>
              <img src={x.image} alt={x.name} />
              <div className="room-body">
                <span className="eyebrow">{x.tag}</span>
                <h3>{x.name}</h3>
                <p>{x.text}</p>
                <Link className="text-link" href={x.href}>
                  Discover more <ArrowUpRight size={17} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
