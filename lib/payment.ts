import { createHmac, timingSafeEqual } from "node:crypto";
import { database, razorpay } from "@/lib/server";
export function validSignature(
  value: string,
  signature: string,
  secret: string,
) {
  if (!/^[a-f0-9]{64}$/.test(signature)) return false;
  return timingSafeEqual(
    Buffer.from(
      createHmac("sha256", secret).update(value).digest("hex"),
      "hex",
    ),
    Buffer.from(signature, "hex"),
  );
}
export async function capturePayment(orderId: string, paymentId: string) {
  const db = database();
  if (!db) throw new Error("Database not configured");
  const payment = await razorpay("payments/" + encodeURIComponent(paymentId));
  if (
    payment.order_id !== orderId ||
    payment.status !== "captured" ||
    payment.currency !== "INR"
  )
    throw new Error("Payment is not captured");
  const { data, error } = await db.rpc("confirm_payment", {
    p_order_id: orderId,
    p_payment_id: paymentId,
    p_amount: payment.amount,
  });
  if (error) throw error;
  return data as { status: string; id: string };
}
