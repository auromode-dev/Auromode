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
  if (!db || !paymentsEnabled())
    return NextResponse.json({
      mode: "enquiry",
      message:
        "Please contact reception to confirm your dates and receive current rates.",
    });
  const { data, error } = await db.rpc("available_rooms", {
    p_category: parsed.data.room,
    p_checkin: parsed.data.checkin,
    p_checkout: parsed.data.checkout,
    p_guests: parsed.data.adults + parsed.data.children,
  });
  if (error)
    return NextResponse.json(
      { error: "We could not check availability. Please contact reception." },
      { status: 503 },
    );
  return NextResponse.json({ mode: "live", rooms: data });
}
