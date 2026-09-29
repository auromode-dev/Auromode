import { createClient } from "@supabase/supabase-js";
export function database() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    return createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } catch {
    return null;
  }
}
export function paymentsEnabled() {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}
export async function razorpay(path: string, body?: unknown) {
  const r = await fetch("https://api.razorpay.com/v1/" + path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(
          process.env.RAZORPAY_KEY_ID + ":" + process.env.RAZORPAY_KEY_SECRET,
        ).toString("base64"),
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
  if (!r.ok) throw new Error("Payment provider unavailable");
  return r.json();
}
