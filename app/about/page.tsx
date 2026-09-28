import { PageHero } from "@/components/page-hero";
import { photos } from "@/lib/content";
import { Leaf, Heart, Sun, Globe } from "lucide-react";
export const metadata = {
  title: "Our Story",
  alternates: { canonical: "/about" },
};
export default function About() {
  return (
    <>
      <PageHero
        eyebrow="ROOTED IN AUROVILLE, SINCE 1975"
        title="A place with a past. A community with a future."
        text="Our story is one of transformation, connection, and the simple joy of welcoming people."
        image={photos.garden}
      />
      <section className="section two-column prose">
        <div>
          <span className="eyebrow">THE AUROMODE STORY</span>
          <h2>
            Always evolving.
            <br />
            <em>Always welcoming.</em>
          </h2>
        </div>
        <div>
          <p>
            Auromode began in 1975 as a fashion factory in Auroville. It was a
            place of making: people coming together, sharing skills, and
            creating something with purpose.
          </p>
          <p>
            In 2014, that same spirit found a new expression. The factory
            transformed into a guesthouse, welcoming travellers into the rhythm
            of Auroville life.
          </p>
          <p>
            Today, accommodation, coworking, dining and thoughtfully made goods
            share one campus. Different reasons to visit. One shared sense of
            belonging.
          </p>
        </div>
      </section>
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="timeline">
          {[
            [
              "1975",
              "A place of making",
              "Auromode begins its journey as a fashion factory.",
            ],
            [
              "2014",
              "A new kind of welcome",
              "The campus transforms into a guesthouse.",
            ],
            [
              "Today",
              "A living ecosystem",
              "Stay, work, eat and connect in the heart of Auroville.",
            ],
          ].map(([year, title, text]) => (
            <div key={year}>
              <strong>{year}</strong>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="benefits">
        <div className="section">
          <span className="eyebrow">WHAT GUIDES US</span>
          <h2>
            A thoughtful way <em>forward.</em>
          </h2>
          <div className="values-grid" style={{ marginTop: 40 }}>
            {[
              [
                Leaf,
                "Sustainability",
                "Thoughtful choices, a closer connection to nature, and respect for the place we call home.",
              ],
              [
                Heart,
                "Community",
                "Shared spaces and everyday encounters that make room for meaningful connections.",
              ],
              [
                Sun,
                "Conscious living",
                "A slower rhythm, room to reflect, and appreciation for the simple things.",
              ],
              [
                Globe,
                "Meaningful travel",
                "Be curious. Meet someone new. Take home more than photographs.",
              ],
            ].map(([Icon, title, text], i) => {
              const C = Icon as typeof Leaf;
              return (
                <div key={i}>
                  <C size={25} strokeWidth={1.2} />
                  <h3>{title as string}</h3>
                  <p>{text as string}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
