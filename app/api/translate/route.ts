import { NextResponse } from "next/server";
import { isLanguage } from "@/lib/languages";
import { loadDictionary, translateStored } from "@/lib/stored-translations";
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
  const dictionary = await loadDictionary(body.language);
  return NextResponse.json(
    {
      translations: body.texts.map((text: string) =>
        translateStored(text, dictionary),
      ),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
