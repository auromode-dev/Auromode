import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://auromode.in";
  return [
    "",
    "/about",
    "/guesthouse",
    "/amenities",
    "/amenities/hive",
    "/amenities/tanto",
    "/amenities/to-be-two",
    "/amenities/offices",
    "/explore",
    "/contact",
    "/book",
  ].map((path) => ({
    url: base + path,
    changeFrequency: "monthly" as const,
    priority: path === "" ? 1 : 0.7,
  }));
}
