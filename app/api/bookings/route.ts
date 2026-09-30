import { NextResponse } from "next/server";
import { staySchema, guestSchema } from "@/lib/validation";
import { database, paymentsEnabled, razorpay } from "@/lib/server";
export async function POST(request: Request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const stay = staySchema.safeParse(body),
    guest = guestSchema.safeParse(body);
  if (!stay.success || !guest.success)
    return NextResponse.json(
      {
        error: !stay.success
          ? stay.error.issues[0].message
          : !guest.success
            ? guest.error.issues[0].message
            : "Invalid booking",
      },
      { status: 400 },
    );
  if (!Number.isSafeInteger(body.expectedAmount) || body.expectedAmount <= 0)
    return NextResponse.json(
      { error: "Please check availability again." },
      { status: 400 },
    );
  const db = database();
  if (!db || !paymentsEnabled())
    return NextResponse.json(
      {
        error:
          "Online payment is temporarily unavailable. No reservation has been made.",
      },
      { status: 503 },
    );
  const { data, error } = await db.rpc(
    stay.data.quantity > 1 ? "reserve_rooms" : "reserve_room",
    {
      ...(stay.data.quantity > 1 ? { p_quantity: stay.data.quantity } : {}),
      p_category: stay.data.room,
      p_checkin: stay.data.checkin,
      p_checkout: stay.data.checkout,
      p_adults: stay.data.adults,
      p_children: stay.data.children,
      p_guest: { ...guest.data, expectedAmount: body.expectedAmount },
    },
  );
  if (error?.code === "PGRST202")
    return NextResponse.json(
      {
        error:
          "Multi-room booking is temporarily unavailable. No reservation has been made.",
      },
      { status: 503 },
    );
  if (error || !data)
    return NextResponse.json(
      {
        error:
          "That room is no longer available for these dates. Please check again or contact reception.",
      },
      { status: 409 },
    );
  try {
    const order = await razorpay("orders", {
      amount: data.amount,
      currency: "INR",
      receipt: data.id,
    });
    const result = await db
      .from("bookings")
      .update({ razorpay_order_id: order.id })
      .eq("id", data.id);
    if (result.error) throw result.error;
    return NextResponse.json({
      bookingId: data.id,
      orderId: order.id,
      amount: data.amount,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch {
    await db
      .from("bookings")
      .update({ status: "cancelled" })
      .in("id", data.ids || [data.id]);
    return NextResponse.json(
      {
        error:
          "Payment could not be started. No payment has been taken. Please try again.",
      },
      { status: 502 },
    );
  }
}
