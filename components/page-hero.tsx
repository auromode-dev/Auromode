import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
export function PageHero({
  eyebrow,
  title,
  text,
  image,
  cta,
}: {
  eyebrow: string;
  title: string;
  text?: string;
  image: string;
  cta?: { label: string; href: string };
}) {
  return (
    <section className="page-hero">
      <img src={image} alt="" fetchPriority="high" />
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      {text && <p>{text}</p>}
      {cta && (
        <Link className="button button-ivory" href={cta.href}>
          {cta.label}
          <ArrowUpRight size={17} />
        </Link>
      )}
    </section>
  );
}
