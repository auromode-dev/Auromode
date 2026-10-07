import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { photos } from "@/lib/content";
const pages = {
  hive: {
    name: "Hive Coworking",
    eyebrow: "A LITTLE SPACE FOR BIG IDEAS",
    title: "Find your focus. Find your people.",
    intro: "Work at your own pace.",
    text: "Bring your ideas and settle into a workday with a different rhythm. Hive brings independent minds together in the heart of the Auromode campus.",
    features: [
      "Flexible workspaces",
      "Private work areas",
      "Meeting rooms",
      "High-speed internet",
    ],
    detail:
      "Whether you need a desk for the day or a regular base, get in touch to discuss workspace availability, current membership plans, and meeting-room needs.",
    image: photos.work,
    action: "Enquire about a workspace",
  },
  tanto: {
    name: "Auromode Restaurant",
    eyebrow: "GOOD FOOD. BETTER COMPANY.",
    title: "Some connections begin at the table.",
    intro: "Pull up a chair.",
    text: "A meal is a reason to pause, to gather, and to enjoy where you are. Auromode Restaurant is part of the daily life of Auromode, welcoming neighbours, travellers, and familiar faces.",
    features: [
      "On-campus dining",
      "Shared meals",
      "A relaxed setting",
      "Local community",
    ],
    detail:
      "Contact reception for the current menu, dietary requirements, restaurant contact details, and opening hours before your visit.",
    image: photos.food,
    action: "Plan a visit to Auromode Restaurant",
  },
  "to-be-two": {
    name: "To Be Two Showroom",
    eyebrow: "THOUGHTFULLY CHOSEN, SIMPLY BEAUTIFUL",
    title: "Everyday things. A little more meaning.",
    intro: "Discover something to take with you.",
    text: "Explore the To Be Two showroom on the Auromode campus. Take your time, look a little closer, and find a piece that feels like you.",
    features: ["Curated collections", "Showroom discovery", "Thoughtful gifting", "On the Auromode campus"],
    detail: "Collections and stock change over time. Get in touch to confirm opening hours, ask about current products, or plan your visit.",
    image: photos.store,
    action: "Enquire about the showroom",
  },
};
export function generateStaticParams() {
  return Object.keys(pages).map((slug) => ({ slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return {
    title: pages[slug as keyof typeof pages]?.name,
    alternates: { canonical: "/amenities/" + slug },
  };
}
export default async function Detail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = pages[slug as keyof typeof pages];
  if (!p) notFound();
  return (
    <>
      <PageHero
        eyebrow={p.eyebrow}
        title={p.title}
        text={p.name}
        image={p.image}
      />
      <section className="section two-column prose">
        <div>
          <span className="eyebrow">{p.name.toUpperCase()}</span>
          <h2>{p.intro}</h2>
          <p>{p.text}</p>
          <div className="feature-list">
            {p.features.map((f) => (
              <span key={f}>{f}</span>
            ))}
          </div>
          <p>{p.detail}</p>
          <Link
            className="button"
            href={"/contact?subject=" + encodeURIComponent(p.name)}
          >
            {p.action}
            <ArrowUpRight size={17} />
          </Link>
        </div>
        <img
          className="large-photo"
          src={p.image}
          alt={`${p.name} atmosphere inspiration`}
        />
      </section>
    </>
  );
}
