import { notFound, redirect } from "next/navigation";
import { isLanguage, languages } from "@/lib/languages";
export function generateStaticParams() {
  return languages
    .filter((l) => l.code !== "en")
    .map((l) => ({ locale: l.code }));
}
export default async function LanguageEntry({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLanguage(locale)) notFound();
  redirect(locale === "en" ? "/" : "/?lang=" + locale);
}
