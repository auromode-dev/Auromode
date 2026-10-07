import { NextResponse } from "next/server";
import { staySchema } from "@/lib/validation";
import { database, paymentsEnabled } from "@/lib/server";
export async function POST(request: Request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = staySchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  const db = database();
  if (!db)
    return NextResponse.json(
      {
        error:
          "Availability is temporarily unavailable. Please try again shortly.",
      },
      { status: 503 },
    );
  const { data, error } = await db.rpc("available_rooms", {
    p_category: parsed.data.room,
    p_checkin: parsed.data.checkin,
    p_checkout: parsed.data.checkout,
    p_guests: Math.ceil(
      (parsed.data.adults + parsed.data.children) / parsed.data.quantity,
    ),
  });
  if (error)
    return NextResponse.json(
      {
        error:
          error.code === "PGRST202"
            ? "The availability function is missing from the database. Reception must check the database migrations."
            : error.code === "42501"
              ? "The availability service does not have database access. Reception must check the server database configuration."
              : "We could not connect to room availability. Please try again shortly or contact reception.",
      },
      { status: 503 },
    );
  return NextResponse.json(
    { mode: "live", rooms: data ?? [], checkoutEnabled: paymentsEnabled() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
