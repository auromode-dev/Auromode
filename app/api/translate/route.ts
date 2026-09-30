import { NextResponse } from "next/server";
import { isLanguage } from "@/lib/languages";
const cache = new Map<string, { text: string; expires: number }>();
const limits = new Map<string, { count: number; until: number }>();
let allowance = { day: "", characters: 0 };
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 30000)
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (
    !isLanguage(body?.language) ||
    !Array.isArray(body.texts) ||
    body.texts.length < 1 ||
    body.texts.length > 100 ||
    body.texts.some(
      (t: unknown) => typeof t !== "string" || !t.trim() || t.length > 3000,
    ) ||
    body.texts.join("").length > 10000
  )
    return NextResponse.json(
      { error: "Invalid translation request" },
      { status: 400 },
    );
  if (body.language === "en")
    return NextResponse.json({ translations: body.texts });
  const key = process.env.AZURE_TRANSLATOR_KEY;
  if (!key)
    return NextResponse.json(
      { error: "Translation is not available yet. Showing English." },
      { status: 503 },
    );
  const now = Date.now();
  for (const [id, limit] of limits) if (limit.until < now) limits.delete(id);
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const limit = limits.get(ip) || { count: 0, until: now + 60000 };
  if (limit.count >= 40 || limits.size > 5000)
    return NextResponse.json(
      { error: "Please wait a minute before translating again." },
      { status: 429 },
    );
  limit.count++;
  limits.set(ip, limit);
  const texts = body.texts as string[],
    language = body.language;
  const cacheKey = (text: string) => language + "\0" + text;
  const missing = [...new Set(texts)].filter((text) => {
    const entry = cache.get(cacheKey(text));
    return !entry || entry.expires < now;
  });
  if (missing.length) {
    const day = new Date().toISOString().slice(0, 10);
    if (allowance.day !== day) allowance = { day, characters: 0 };
    const size = missing.join("").length;
    if (allowance.characters + size > 200000)
      return NextResponse.json(
        { error: "Translation limit reached. Showing English." },
        { status: 429 },
      );
    allowance.characters += size;
    try {
      const response = await fetch(
        "https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=en&to=" +
          encodeURIComponent(language),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Ocp-Apim-Subscription-Key": key,
            ...(process.env.AZURE_TRANSLATOR_REGION
              ? {
                  "Ocp-Apim-Subscription-Region":
                    process.env.AZURE_TRANSLATOR_REGION,
                }
              : {}),
          },
          body: JSON.stringify(missing.map((Text) => ({ Text }))),
          signal: AbortSignal.timeout(15000),
          cache: "no-store",
        },
      );
      if (!response.ok) throw new Error("Provider unavailable");
      const data = await response.json();
      if (
        !Array.isArray(data) ||
        data.length !== missing.length ||
        data.some((item) => typeof item.translations?.[0]?.text !== "string")
      )
        throw new Error("Invalid provider response");
      missing.forEach((text, i) =>
        cache.set(cacheKey(text), {
          text: data[i].translations[0].text,
          expires: now + 86400000,
        }),
      );
      const translations = texts.map((text) => cache.get(cacheKey(text))!.text);
      while (cache.size > 12000) cache.delete(cache.keys().next().value!);
      return NextResponse.json(
        { translations },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch {
      return NextResponse.json(
        { error: "Translation is temporarily unavailable. Showing English." },
        { status: 503 },
      );
    }
  }
  return NextResponse.json(
    { translations: texts.map((text) => cache.get(cacheKey(text))!.text) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
