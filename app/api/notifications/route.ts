import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { database } from "@/lib/server";
function escapeHtml(text: string) {
  return text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
async function email(to: string, subject: string, text: string, key: string) {
  const result = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + process.env.RESEND_API_KEY,
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify({
      from: process.env.NOTIFICATION_FROM_EMAIL,
      to: [to],
      subject,
      text,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.8;white-space:pre-line">${escapeHtml(text)}</div>`,
    }),
  });
  if (!result.ok) throw new Error("Email delivery failed");
}
async function whatsapp(to: string, values: string[]) {
  const result = await fetch(
    `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || "v23.0"}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + process.env.WHATSAPP_ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace(/\D/g, ""),
        type: "template",
        template: {
          name: process.env.WHATSAPP_TEMPLATE_NAME,
          language: { code: "en" },
          components: [
            {
              type: "body",
              parameters: values.map((text) => ({ type: "text", text })),
            },
          ],
        },
      }),
    },
  );
  if (!result.ok) throw new Error("WhatsApp delivery failed");
}
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
  const db = database();
  if (
    !db ||
    !process.env.RESEND_API_KEY ||
    !process.env.NOTIFICATION_FROM_EMAIL ||
    !process.env.ADMIN_NOTIFICATION_EMAIL
  )
    return NextResponse.json(
      { error: "Notification services are not configured" },
      { status: 503 },
    );
  const tomorrow = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date(Date.now() + 86400000));
  const reminders = await db
    .from("bookings")
    .select("id")
    .eq("status", "confirmed")
    .eq("checkin", tomorrow);
  if (reminders.error)
    return NextResponse.json(
      { error: "Unable to schedule reminders" },
      { status: 503 },
    );
  for (const row of reminders.data || [])
    await db
      .from("notification_outbox")
      .upsert(
        { booking_id: row.id, event: "checkin_reminder" },
        { onConflict: "booking_id,event", ignoreDuplicates: true },
      );
  const { data: jobs, error } = await db.rpc("claim_notifications");
  if (error)
    return NextResponse.json(
      { error: "Unable to claim notification queue" },
      { status: 503 },
    );
  let delivered = 0,
    failed = 0;
  for (const job of jobs || []) {
    try {
      const { data: b, error: bookingError } = await db
        .from("bookings")
        .select("*")
        .eq("id", job.booking_id)
        .single();
      if (bookingError || !b) throw new Error("Booking unavailable");
      const event = job.event.replaceAll("_", " ");
      const text = `Hello ${b.first_name},\n\nAuromode booking update: ${event}.\nReference: ${b.id}\nStay: ${b.checkin} to ${b.checkout}\nBooking status: ${b.status}\nPayment status: ${b.payment_status.replaceAll("_", " ")}\nTotal: INR ${(b.amount / 100).toFixed(2)}\n\n${job.event === "checkin_reminder" ? "Reception is open Monday–Saturday, 9:30 AM–5:00 PM. Please contact us to arrange your arrival.\n\n" : ""}For assistance, contact avapart@gmail.com or +91 413 262 22 24.\nAuromode Auroville`;
      const admin = ["new_booking", "cancelled", "payment_review"].includes(
        job.event,
      );
      const guest = [
        "confirmed",
        "cancelled",
        "payment_review",
        "checkin_reminder",
      ].includes(job.event);
      const save = async (column: string) => {
        const r = await db
          .from("notification_outbox")
          .update({ [column]: true })
          .eq("id", job.id);
        if (r.error) throw r.error;
      };
      if (admin && !job.admin_email_sent) {
        await email(
          process.env.ADMIN_NOTIFICATION_EMAIL!,
          `Auromode · ${event}`,
          text,
          job.id + "-admin",
        );
        await save("admin_email_sent");
      }
      if (guest && !job.guest_email_sent) {
        await email(
          b.email,
          `Your Auromode stay · ${event}`,
          text,
          job.id + "-guest",
        );
        await save("guest_email_sent");
      }
      const hasWhatsApp = !!(
        process.env.WHATSAPP_ACCESS_TOKEN &&
        process.env.WHATSAPP_PHONE_NUMBER_ID &&
        process.env.WHATSAPP_TEMPLATE_NAME
      );
      if (hasWhatsApp) {
        const values = [b.first_name, b.id, event, b.checkin, b.checkout];
        if (
          admin &&
          process.env.ADMIN_WHATSAPP_NUMBER &&
          !job.admin_whatsapp_sent
        ) {
          await whatsapp(process.env.ADMIN_WHATSAPP_NUMBER, values);
          await save("admin_whatsapp_sent");
        }
        if (guest && b.whatsapp_opt_in && !job.guest_whatsapp_sent) {
          await whatsapp(b.phone, values);
          await save("guest_whatsapp_sent");
        }
      }
      const saved = await db
        .from("notification_outbox")
        .update({ delivered_at: new Date().toISOString(), locked_until: null })
        .eq("id", job.id);
      if (saved.error) throw saved.error;
      delivered++;
    } catch {
      failed++;
      await db
        .from("notification_outbox")
        .update({
          locked_until: null,
          next_attempt_at: new Date(Date.now() + 300000).toISOString(),
        })
        .eq("id", job.id);
    }
  }
  return NextResponse.json({ delivered, failed });
}
