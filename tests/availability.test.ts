import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/availability/route";
const stay = {
  checkin: "2090-10-10",
  checkout: "2090-10-12",
  adults: 2,
  children: 0,
  room: "twin",
};
const request = (body: unknown = stay) =>
  new Request("http://localhost/api/availability", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
test("availability uses inventory independently of payment/email configuration", async (t) => {
  const keys = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
    "RESEND_API_KEY",
  ];
  const previous = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );
  t.after(() => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
  delete process.env.RESEND_API_KEY;
  const rooms = [
    {
      id: "test-room",
      name: "Standard 1",
      nightly_rate: 250000,
      cancellation_terms: "Test terms",
    },
  ];
  let result: unknown = rooms,
    status = 200,
    calls = 0;
  t.mock.method(
    globalThis,
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      calls++;
      assert.ok(String(input).endsWith("/rest/v1/rpc/available_rooms"));
      assert.deepEqual(JSON.parse(String(init?.body)), {
        p_category: "twin",
        p_checkin: "2090-10-10",
        p_checkout: "2090-10-12",
        p_guests: 2,
      });
      return new Response(JSON.stringify(result), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    },
  );
  await t.test("returns rooms without Razorpay or Resend", async () => {
    const r = await POST(request());
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("cache-control"), "no-store");
    assert.deepEqual(await r.json(), {
      mode: "live",
      rooms,
      checkoutEnabled: false,
    });
  });
  await t.test("empty inventory is a real unavailable result", async () => {
    result = [];
    const r = await POST(request());
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), {
      mode: "live",
      rooms: [],
      checkoutEnabled: false,
    });
  });
  await t.test("database failures are not reported as sold out", async () => {
    status = 500;
    result = { message: "Database unavailable", code: "XX000" };
    const r = await POST(request());
    assert.equal(r.status, 503);
    const body = await r.json();
    assert.ok(body.error);
    assert.equal(body.rooms, undefined);
  });
  await t.test("invalid dates never query inventory", async () => {
    const before = calls;
    const r = await POST(request({ ...stay, checkout: stay.checkin }));
    assert.equal(r.status, 400);
    assert.equal(calls, before);
  });
  await t.test(
    "missing configuration fails without email fallback",
    async () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      const before = calls;
      const r = await POST(request());
      assert.equal(r.status, 503);
      assert.equal((await r.json()).mode, undefined);
      assert.equal(calls, before);
    },
  );
  await t.test("invalid project URL fails gracefully", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "invalid";
    const r = await POST(request());
    assert.equal(r.status, 503);
  });
});
