import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/admin/booking-notifications/route";
test("direct-booking notifications require admin access and send guest confirmation with readable reference", async (t) => {
  const settings = {
    NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test",
    RESEND_API_KEY: "test",
    NOTIFICATION_FROM_EMAIL: "test@example.com",
    ADMIN_NOTIFICATION_EMAIL: "admin@example.com",
  };
  for (const [key, value] of Object.entries(settings)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }
  const id = "00000000-0000-4000-8000-000000000001";
  let admin = false,
    fail = false,
    sends = 0;
  const patches: Record<string, unknown>[] = [];
  const json = (value: unknown) =>
    new Response(JSON.stringify(value), {
      headers: { "Content-Type": "application/json" },
    });
  t.mock.method(
    globalThis,
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/auth/v1/user"))
        return json({ id, app_metadata: admin ? { role: "admin" } : {} });
      if (url.endsWith("/rpc/claim_booking_notifications")) {
        assert.equal(JSON.parse(String(init?.body)).p_booking_id, id);
        return json([
          {
            id: "job",
            booking_id: id,
            event: "confirmed",
            guest_email_sent: false,
          },
        ]);
      }
      if (url.includes("api.resend.com")) {
        sends++;
        const body = JSON.parse(String(init?.body));
        assert.deepEqual(body.to, ["guest@example.com"]);
        assert.ok(body.text.includes("avapart_20901010_R22_1"));
        assert.ok(body.text.includes("unpaid"));
        assert.equal(
          (init?.headers as Record<string, string>)["Idempotency-Key"],
          "job-guest",
        );
        return fail
          ? new Response("{}", { status: 503 })
          : json({ id: "email" });
      }
      if (init?.method === "PATCH") {
        patches.push(JSON.parse(String(init.body)));
        return new Response(null, { status: 204 });
      }
      if (url.includes("checkin=eq.")) return json([]);
      if (url.includes("booking_source=eq.reception")) return json({ id });
      if (url.includes("/bookings?"))
        return json({
          id,
          booking_reference: "avapart_20901010_R22_1",
          first_name: "Guest",
          email: "guest@example.com",
          checkin: "2090-10-10",
          checkout: "2090-10-12",
          status: "confirmed",
          payment_status: "unpaid",
          amount: 300000,
          whatsapp_opt_in: false,
        });
      throw Error("Unexpected request");
    },
  );
  const req = () =>
    new Request("http://localhost/api/admin/booking-notifications", {
      method: "POST",
      headers: { Authorization: "Bearer test" },
      body: JSON.stringify({ bookingId: id }),
    });
  assert.equal((await POST(req())).status, 403);
  assert.equal(sends, 0);
  admin = true;
  assert.deepEqual(await (await POST(req())).json(), {
    delivered: 1,
    failed: 0,
  });
  assert.ok(patches.some((p) => p.guest_email_sent === true));
  patches.length = 0;
  fail = true;
  assert.deepEqual(await (await POST(req())).json(), {
    delivered: 0,
    failed: 1,
  });
  assert.ok(patches.some((p) => p.next_attempt_at));
  assert.ok(!patches.some((p) => p.guest_email_sent));
});
