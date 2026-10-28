import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/contact/route";

test("cancellation requests require a reference and create enquiries only", async (t) => {
  const settings = {
    NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test",
    RESEND_API_KEY: "",
  };
  for (const [key, value] of Object.entries(settings)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }
  const records: Record<string, unknown>[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      assert.ok(
        String(input).endsWith("/rest/v1/enquiries"),
        "No booking changes, payment calls or guest lookup",
      );
      assert.equal(init?.method, "POST");
      records.push(JSON.parse(String(init?.body)));
      return new Response(null, { status: 201 });
    },
  );
  const body = {
    name: "Test Guest",
    email: "guest@example.com",
    phone: "123456789",
    subject: "Cancellation request",
    message: "Please cancel my stay on 10–12 December.",
    requestType: "cancellation",
    bookingReference: "avapart_20901210_R22_1",
  };
  const submit = (data: unknown) =>
    POST(
      new Request("http://localhost/api/contact", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    );
  assert.equal((await submit({ ...body, bookingReference: " " })).status, 400);
  assert.equal(
    (await submit({ ...body, bookingReference: "x".repeat(101) })).status,
    400,
  );
  assert.equal(records.length, 0);
  const response = await submit(body);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, emailPending: true });
  assert.equal(
    records[0].subject,
    "Cancellation request - avapart_20901210_R22_1",
  );
  assert.equal(records[0].message, body.message);
  assert.equal(records[0].notify_email, true);
  assert.equal(records[0].requestType, undefined);
  assert.equal(records[0].bookingReference, undefined);
  assert.equal(
    (
      await submit({
        ...body,
        requestType: "enquiry",
        bookingReference: "",
        subject: "General question",
      })
    ).status,
    200,
  );
  assert.equal(records[1].subject, "General question");
});
