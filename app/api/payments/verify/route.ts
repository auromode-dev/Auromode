import { NextResponse } from "next/server";
import { validSignature, capturePayment } from "@/lib/payment";
export async function POST(request: Request) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret)
    return NextResponse.json(
      { error: "Payments are unavailable" },
      { status: 503 },
    );
  try {
    const p = await request.json();
    if (
      typeof p.razorpay_order_id !== "string" ||
      typeof p.razorpay_payment_id !== "string" ||
      typeof p.razorpay_signature !== "string" ||
      !validSignature(
        p.razorpay_order_id + "|" + p.razorpay_payment_id,
        p.razorpay_signature,
        secret,
      )
    )
      return NextResponse.json(
        { error: "Invalid payment signature" },
        { status: 400 },
      );
    const result = await capturePayment(
      p.razorpay_order_id,
      p.razorpay_payment_id,
    );
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      {
        error:
          "Payment confirmation is pending. Please contact reception before paying again.",
      },
      { status: 409 },
    );
  }
}
