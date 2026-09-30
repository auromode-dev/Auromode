import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/availability/suggestions/route";
test("suggestions use sufficient live rooms, sum distinct prices and preserve stay duration", async (t) => {
  const keys = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const previous = keys.map((k) => process.env[k]);
  t.after(() =>
    keys.forEach((k, i) => {
      if (previous[i] === undefined) delete process.env[k];
      else process.env[k] = previous[i];
    }),
  );
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test";
  let fail = false;
  t.mock.method(
    globalThis,
    "fetch",
    async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (fail)
        return new Response(JSON.stringify({ message: "offline" }), {
          status: 503,
        });
      const args = JSON.parse(String(init?.body));
      let rows: unknown[] = [];
      if (args.p_category === "twin") {
        assert.equal(args.p_guests, 2);
        rows = [
          { id: "a", nightly_rate: 200000 },
          { id: "b", nightly_rate: 250000 },
        ];
      }
      if (args.p_category === "studio")
        rows = [{ id: "one", nightly_rate: 150000 }];
      if (args.p_category === "family" && args.p_checkin === "2090-10-11")
        rows = [{ id: "family", nightly_rate: 400000 }];
      return new Response(JSON.stringify(rows), {
        headers: { "Content-Type": "application/json" },
      });
    },
  );
  const request = () =>
    new Request("http://localhost/api/availability/suggestions", {
      method: "POST",
      body: JSON.stringify({
        room: "family",
        adults: 4,
        children: 0,
        checkin: "2090-10-10",
        checkout: "2090-10-12",
      }),
    });
  const response = await POST(request());
  assert.equal(response.status, 200);
  const { suggestions } = await response.json();
  assert.deepEqual(suggestions, [
    {
      room: "twin",
      quantity: 2,
      checkin: "2090-10-10",
      checkout: "2090-10-12",
      nightly_rate: 450000,
    },
    {
      room: "family",
      quantity: 1,
      checkin: "2090-10-11",
      checkout: "2090-10-13",
      nightly_rate: 400000,
    },
  ]);
  fail = true;
  assert.equal((await POST(request())).status, 503);
});
