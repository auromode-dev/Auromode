import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/translate/route";
test("translation validates requests, protects its key, caches results and handles outages", async (t) => {
  const previous = process.env.AZURE_TRANSLATOR_KEY;
  t.after(() => {
    if (previous === undefined) delete process.env.AZURE_TRANSLATOR_KEY;
    else process.env.AZURE_TRANSLATOR_KEY = previous;
  });
  const req = (body: unknown, origin = "http://localhost") =>
    new Request("http://localhost/api/translate", {
      method: "POST",
      headers: { origin },
      body: JSON.stringify(body),
    });
  delete process.env.AZURE_TRANSLATOR_KEY;
  assert.equal(
    (await POST(req({ language: "fr", texts: ["Welcome"] }))).status,
    503,
  );
  assert.equal(
    (await POST(req({ language: "invalid", texts: ["Welcome"] }))).status,
    400,
  );
  assert.equal(
    (
      await POST(
        req({ language: "fr", texts: ["Welcome"] }, "https://other.example"),
      )
    ).status,
    403,
  );
  assert.deepEqual(
    await (await POST(req({ language: "en", texts: ["Welcome"] }))).json(),
    { translations: ["Welcome"] },
  );
  process.env.AZURE_TRANSLATOR_KEY = "test-secret";
  let calls = 0,
    fail = false;
  t.mock.method(
    globalThis,
    "fetch",
    async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls++;
      assert.equal(
        (init?.headers as Record<string, string>)["Ocp-Apim-Subscription-Key"],
        "test-secret",
      );
      if (fail) return new Response("{}", { status: 500 });
      const texts = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify(
          texts.map((entry: { Text: string }) => ({
            translations: [{ text: "FR " + entry.Text }],
          })),
        ),
        { headers: { "Content-Type": "application/json" } },
      );
    },
  );
  const body = { language: "fr", texts: ["Welcome", "Book your stay"] };
  const response = await POST(req(body));
  const result = await response.json();
  assert.deepEqual(result, {
    translations: ["FR Welcome", "FR Book your stay"],
  });
  assert.ok(!JSON.stringify(result).includes("test-secret"));
  await POST(req(body));
  assert.equal(calls, 1);
  fail = true;
  assert.equal(
    (await POST(req({ language: "de", texts: ["New phrase"] }))).status,
    503,
  );
});
