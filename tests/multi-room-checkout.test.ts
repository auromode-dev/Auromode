import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/bookings/route";
test("multi-room checkout cancels every hold on order failure and links only the lead on success", async (t) => {
  const keys = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
  ];
  const previous = keys.map((k) => process.env[k]);
  t.after(() =>
    keys.forEach((k, i) => {
      if (previous[i] === undefined) delete process.env[k];
      else process.env[k] = previous[i];
    }),
  );
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test";
  process.env.RAZORPAY_KEY_ID = "test";
  process.env.RAZORPAY_KEY_SECRET = "test";
  let fail = true;
  const patches: { url: string; body: Record<string, string> }[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/rpc/reserve_rooms")) {
        const params = JSON.parse(String(init?.body));
        assert.equal(params.p_quantity, 2);
        return new Response(
          JSON.stringify({
            id: "lead",
            ids: ["lead", "second"],
            amount: 900000,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/orders"))
        return new Response(JSON.stringify({ id: "order" }), {
          status: fail ? 500 : 200,
          headers: { "Content-Type": "application/json" },
        });
      if (init?.method === "PATCH") {
        patches.push({ url, body: JSON.parse(String(init.body)) });
        return new Response(null, { status: 204 });
      }
      throw new Error("Unexpected request");
    },
  );
  const request = () =>
    new Request("http://localhost/api/bookings", {
      method: "POST",
      body: JSON.stringify({
        room: "twin",
        quantity: 2,
        adults: 4,
        children: 0,
        checkin: "2090-10-10",
        checkout: "2090-10-12",
        firstName: "Test",
        lastName: "Guest",
        email: "test@example.com",
        phone: "123456789",
        consent: true,
        expectedAmount: 900000,
      }),
    });
  assert.equal((await POST(request())).status, 502);
  assert.equal(patches[0].body.status, "cancelled");
  assert.equal(
    new URL(patches[0].url).searchParams.get("id"),
    "in.(lead,second)",
  );
  fail = false;
  const response = await POST(request());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).amount, 900000);
  assert.equal(new URL(patches[1].url).searchParams.get("id"), "eq.lead");
});
