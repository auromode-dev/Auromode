import { NextResponse } from "next/server";
import { staySchema } from "@/lib/validation";
import { roomCategories, roomCapacity } from "@/lib/rooms";
import { database } from "@/lib/server";
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
      { error: "Suggestions are temporarily unavailable." },
      { status: 503 },
    );
  const stay = parsed.data,
    guests = stay.adults + stay.children;
  const candidates: {
    room: typeof stay.room;
    quantity: number;
    checkin: string;
    checkout: string;
  }[] = [];
  for (const room of roomCategories) {
    const quantity = Math.ceil(guests / roomCapacity[room]);
    if (
      quantity <= stay.adults &&
      quantity <= 4 &&
      (room !== stay.room || quantity !== stay.quantity)
    )
      candidates.push({
        room,
        quantity,
        checkin: stay.checkin,
        checkout: stay.checkout,
      });
  }
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());
  const shift = (date: string, days: number) =>
    new Date(new Date(date + "T00:00:00Z").getTime() + days * 86400000)
      .toISOString()
      .slice(0, 10);
  for (const offset of [1, -1, 2, -2, 3, -3]) {
    const checkin = shift(stay.checkin, offset);
    if (checkin >= today)
      candidates.push({
        room: stay.room,
        quantity: stay.quantity,
        checkin,
        checkout: shift(stay.checkout, offset),
      });
  }
  try {
    const results = await Promise.all(
      candidates.map(async (c) => {
        const { data, error } = await db.rpc("available_rooms", {
          p_category: c.room,
          p_checkin: c.checkin,
          p_checkout: c.checkout,
          p_guests: Math.ceil(guests / c.quantity),
        });
        if (error) throw error;
        if ((data?.length || 0) < c.quantity) return null;
        return {
          ...c,
          nightly_rate: data
            .slice(0, c.quantity)
            .reduce(
              (sum: number, r: { nightly_rate: number }) =>
                sum + r.nightly_rate,
              0,
            ),
        };
      }),
    );
    return NextResponse.json(
      { suggestions: results.filter(Boolean).slice(0, 6) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Suggestions could not be checked. Please try again." },
      { status: 503 },
    );
  }
}
