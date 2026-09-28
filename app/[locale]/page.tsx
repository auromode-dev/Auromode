import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { localized } from "@/lib/locales";
import { PageHero } from "@/components/page-hero";
import { photos } from "@/lib/content";
export function generateStaticParams() {
  return [{ locale: "fr" }, { locale: "ta" }];
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const c = localized[locale as keyof typeof localized];
  return {
    title: c?.title,
    description: c?.subtitle,
    alternates: {
      canonical: "/" + locale,
      languages: { en: "/", fr: "/fr", ta: "/ta" },
    },
  };
}
export default async function LocalizedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const c = localized[locale as keyof typeof localized];
  if (!c) notFound();
  return (
    <div lang={locale} className={locale === "ta" ? "tamil-page" : ""}>
      <PageHero
        eyebrow={c.tag}
        title={c.title}
        text={c.subtitle}
        image={photos.hero}
        cta={{ label: c.book, href: "#stay" }}
      />
      <section id="story" className="section two-column prose">
        <div>
          <span className="eyebrow">1975 — {new Date().getFullYear()}</span>
          <h2>{c.storyTitle}</h2>
          <p>{c.story}</p>
        </div>
        <img className="large-photo" src={photos.garden} alt="Auromode" />
      </section>
      <section
        id="stay"
        className="section two-column prose"
        style={{ paddingTop: 0 }}
      >
        <img className="large-photo" src={photos.room} alt={c.nav[1]} />
        <div>
          <h2>{c.stayTitle}</h2>
          <p>{c.stayText}</p>
          <a
            className="button"
            href={
              "mailto:avapart@gmail.com?subject=" + encodeURIComponent(c.book)
            }
          >
            {c.email}
            <ArrowUpRight size={17} />
          </a>
          <p className="form-note">{c.bookingNote}</p>
          <Link className="text-link" href="/book">
            {c.online}
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </section>
      <section id="campus" className="benefits">
        <div className="section">
          <span className="eyebrow">AUROMODE</span>
          <h2>{c.workTitle}</h2>
          <div className="location-grid" style={{ marginTop: 35 }}>
            {[
              [photos.work, "Hive Coworking", c.work],
              [photos.food, "Tanto Restaurant", c.eat],
              [photos.store, "To Be Two", c.shop],
            ].map(([image, title, text]) => (
              <article key={title}>
                <img
                  style={{ height: 240, marginBottom: 20 }}
                  src={image}
                  alt={title}
                />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section id="explore" className="section prose">
        <h2>{c.exploreTitle}</h2>
        <p>{c.explore}</p>
        <a
          className="text-link"
          href="https://www.google.com/maps/search/?api=1&query=Auromode+Auroville"
        >
          {c.directions}
          <ArrowUpRight size={16} />
        </a>
      </section>
      <section id="contact" className="cta-banner">
        <div>
          <h2>{c.contactTitle}</h2>
          <p style={{ color: "#d1d7ca", marginTop: 20 }}>{c.hours}</p>
          <a href="tel:+914132622224">+91 413 262 22 24</a>
        </div>
        <div>
          <a className="button button-ivory" href="mailto:avapart@gmail.com">
            {c.email}
            <ArrowUpRight size={16} />
          </a>
          <a href="https://wa.me/917871562343">{c.whatsapp}</a>
        </div>
      </section>
    </div>
  );
}
