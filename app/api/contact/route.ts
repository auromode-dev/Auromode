import { processContactEmails } from "@/lib/contact-notifications";
﻿import { NextResponse } from "next/server";
import { database } from "@/lib/server";
import { contactSchema } from "@/lib/validation";
export async function POST(request: Request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const p = contactSchema.safeParse(body);
  if (!p.success)
    return NextResponse.json(
      { error: p.error.issues[0].message },
      { status: 400 },
    );
  const db = database();
  if (!db)
    return NextResponse.json(
      {
        error:
          "The online enquiry service is not connected yet. You can send your message directly by email.",
      },
      { status: 503 },
    );
  const id=crypto.randomUUID();
  const { error } = await db.from("enquiries").insert({...p.data,id,notify_email:true});
  if (error)
    return NextResponse.json(
      {
        error:
          "Your enquiry could not be saved. Please contact reception directly.",
      },
      { status: 503 },
    );
  let notification={pending:true};
  try { notification=await processContactEmails(id); } catch {}
  return NextResponse.json({ ok: true, emailPending:notification.pending });
}
