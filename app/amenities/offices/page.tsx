import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { OfficeRentals } from "@/components/office-rentals";
import { photos } from "@/lib/content";

export const metadata: Metadata = {
  title: "Office Rentals",
  description:
    "Newly renovated offices of 20, 30 and 40 sq. m. at Auromode, Auroville. Explore facilities, rental contacts and our campus business community.",
  alternates: { canonical: "/amenities/offices" },
};

export default function Offices() {
  return (
    <>
      <PageHero
        eyebrow="OFFICE RENTALS AT AUROMODE"
        title="A quieter place for your next big idea."
        text="Thoughtfully renovated offices surrounded by nature, with space to work, connect, and grow."
        image={photos.garden}
        cta={{ label: "Explore the offices", href: "#offices" }}
      />
      <OfficeRentals />
    </>
  );
}
