import { NextResponse } from "next/server";
import { validSignature, capturePayment } from "@/lib/payment";
export async function POST(request: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret)
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 },
    );
  const raw = await request.text();
  if (
    !validSignature(
      raw,
      request.headers.get("x-razorpay-signature") || "",
      secret,
    )
  )
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  try {
    const event = JSON.parse(raw);
    if (event.event === "payment.captured") {
      const p = event.payload.payment.entity;
      await capturePayment(p.order_id, p.id);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Payment could not be reconciled" },
      { status: 500 },
    );
  }
}
