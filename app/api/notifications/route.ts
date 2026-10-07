import { processContactEmails } from "@/lib/contact-notifications";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { processNotifications } from "@/lib/notifications";
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") || "";
  const expected = "Bearer " + secret;
  if (
    !secret ||
    auth.length !== expected.length ||
    !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [bookingResult, contactResult]=await Promise.allSettled([processNotifications(),processContactEmails()]);
  const response=bookingResult.status==="fulfilled"?bookingResult.value:null;
  const bookings=response?await response.json():{error:"Booking notifications unavailable"};
  return NextResponse.json({...bookings,contact:contactResult.status==="fulfilled"?contactResult.value:{pending:true}}, {status:response?.ok && contactResult.status==="fulfilled" && !contactResult.value.pending?200:503});
}
