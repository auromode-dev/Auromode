import { NextResponse } from "next/server";
import { database } from "@/lib/server";
import { processNotifications } from "@/lib/notifications";
import { z } from "zod";
export async function POST(request: Request) {
  const db = database();
  if (!db)
    return NextResponse.json(
      { error: "Notifications unavailable" },
      { status: 503 },
    );
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { data, error } = await db.auth.getUser(token);
  if (error || data.user?.app_metadata?.role !== "admin")
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 },
    );
  const input = z
    .object({ bookingId: z.string().uuid() })
    .safeParse(await request.json().catch(() => null));
  if (!input.success)
    return NextResponse.json({ error: "Invalid booking" }, { status: 400 });
  const booking = await db
    .from("bookings")
    .select("id")
    .eq("id", input.data.bookingId)
    .eq("booking_source", "reception")
    .maybeSingle();
  if (booking.error || !booking.data)
    return NextResponse.json(
      { error: "Reception booking not found" },
      { status: 404 },
    );
  return processNotifications(input.data.bookingId);
}
