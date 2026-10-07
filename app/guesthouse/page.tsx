import { RoomGallery } from "@/components/room-gallery";
import { roomImages } from "@/lib/rooms";
import { database } from "@/lib/server";
import Link from "next/link";
import { Users, Wifi, ArrowUpRight } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { AvailabilitySearch } from "@/components/availability-search";
import { photos, roomTypes } from "@/lib/content";
export const metadata = {
  title: "Guesthouse & Rooms",
  alternates: { canonical: "/guesthouse" },
};
export const dynamic = "force-dynamic";
export default async function Guesthouse() {
  const db = database();
  const inventory = db
    ? (
        await db
          .from("rooms")
          .select("category,nightly_rate,image_url,image_urls")
          .eq("active", true)
          .order("nightly_rate")
      ).data
    : null;
  return (
    <>
      <PageHero
        eyebrow="MAKE YOURSELF AT HOME"
        title="Stay a little. Breathe a little deeper."
        text="Thoughtfully simple spaces for a good night's sleep and a fresh start. Find the room that feels right for you."
        image={photos.room}
        cta={{ label: "Plan your stay", href: "/book" }}
      />
      <div className="search-wrap">
        <AvailabilitySearch />
      </div>
      <section className="section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">YOUR OWN LITTLE CORNER</span>
            <h2>
              Room to <em>unwind.</em>
            </h2>
          </div>
          <p>
            Travelling solo, together, or staying a while?
            <br />
            There’s a place for you here.
          </p>
        </div>
        <div className="room-grid">
          {roomTypes.map((room) => (
            <article className="room-card" key={room.id}>
              <RoomGallery
                name={room.name}
                images={[
                  ...new Set(
                    (inventory?.filter((r) => r.category === room.id) || [])
                      .flatMap((r) => roomImages(r, room.image))
                      .concat(room.image),
                  ),
                ].slice(0, 12)}
              />
              <div className="room-body">
                <div className="room-meta">
                  <span>
                    <Users size={14} /> {room.beds} bed
                    {room.beds === 1 ? "" : "s"}
                  </span>
                  <span>
                    <Wifi size={14} /> WiFi
                  </span>
                </div>
                <h3>{room.name}</h3>
                <p>{room.description}</p>
                <div className="room-bottom">
                  <span>
                    {inventory?.some((r) => r.category === room.id)
                      ? "From ₹" +
                        (
                          inventory.find((r) => r.category === room.id)!
                            .nightly_rate / 100
                        ).toLocaleString("en-IN") +
                        " / night"
                      : "Contact us for current rates"}
                  </span>
                  <Link className="text-link" href={"/book?room=" + room.id}>
                    Explore your stay <ArrowUpRight size={16} />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
        <div className="feature-list">
          {[
            "High-speed WiFi",
            "Air conditioning",
            "Housekeeping",
            "Workspace",
            "Garden areas",
            "Yoga space",
          ].map((x) => (
            <span key={x}>{x}</span>
          ))}
        </div>
        <p className="form-note">
          Photos show the room categories. Rates are per room, per night,
          including taxes. Check your dates for live availability.
        </p>
      </section>
      <section
        className="section monthly-stay"
        aria-labelledby="monthly-stay-title"
      >
        <div>
          <span className="eyebrow">
            A LITTLE LONGER. A LITTLE MORE AT HOME.
          </span>
          <h2 id="monthly-stay-title">
            Make room for
            <br />a longer stay.
          </h2>
        </div>
        <div>
          <p>
            Planning to stay for a month, two months, or longer? Contact
            reception to discuss your dates, room preferences, monthly rates,
            and booking terms.
          </p>
          <p>Our team will help you plan your stay based on availability.</p>
          <Link
            className="button"
            href="/contact?subject=Monthly%20stay%20enquiry"
          >
            Enquire about a monthly stay <ArrowUpRight size={16} />
          </Link>
          <a
            className="text-link"
            href="https://wa.me/917871562343?text=Hello%2C%20I%20would%20like%20to%20enquire%20about%20a%20monthly%20stay%20at%20Auromode."
          >
            Chat with reception <ArrowUpRight size={16} />
          </a>
        </div>
      </section>
      <section className="faq">
        <span className="eyebrow" style={{ textAlign: "center" }}>
          A FEW THINGS YOU MIGHT WONDER
        </span>
        <h2>
          Before you <em>arrive.</em>
        </h2>
        {[
          [
            "How do I book a room?",
            "Choose your dates and room type to see live availability and rates immediately. When online payment is enabled, enter your details and pay securely to confirm your booking.",
          ],
          [
            "Can I stay for a longer period?",
            "Yes, we welcome long-stay enquiries. Tell us your preferred dates and a little about your plans so we can discuss an option with you.",
          ],
          [
            "What are the check-in and check-out times?",
            "Please contact reception to confirm check-in and check-out arrangements. Reception is open Monday to Saturday, 9:30 AM–5:00 PM. Let us know if you expect to arrive outside these hours.",
          ],
          [
            "Is the campus suitable for remote work?",
            "Auromode is home to Hive Coworking. Contact us about workspace access, memberships, and meeting your work requirements during your stay.",
          ],
          [
            "What is the cancellation policy?",
            "Cancellation and refund terms are provided with your booking offer. Please review them with reception before making a payment.",
          ],
        ].map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </section>
    </>
  );
}
