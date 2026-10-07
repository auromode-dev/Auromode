import type { Metadata } from "next";
import "./globals.css";
import { SiteShell } from "@/components/site-shell";
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://auromode.in",
  ),
  title: {
    default: "Auromode Auroville — A place to stay. A way to be.",
    template: "%s | Auromode Auroville",
  },
  description:
    "Stay, work, eat and connect at Auromode. Discover a welcoming guesthouse, Hive Coworking, Auromode Restaurant and meaningful experiences in Auroville.",
  openGraph: {
    type: "website",
    siteName: "Auromode Auroville",
    title: "Auromode — A place to stay. A way to be.",
    description: "Come for a stay. Find a sense of belonging.",
    images: ["/opengraph-image"],
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <SiteShell>{children}</SiteShell>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Hotel",
              name: "Auromode Auroville",
              url: "https://auromode.in",
              telephone: "+914132622224",
              email: "avapart@gmail.com",
              address: {
                "@type": "PostalAddress",
                streetAddress: "Auroshilpam",
                addressLocality: "Auroville",
                addressRegion: "Tamil Nadu",
                postalCode: "605101",
                addressCountry: "IN",
              },
            }),
          }}
        />
      </body>
    </html>
  );
}
