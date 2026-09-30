import { chromium, type Page, type Route } from "@playwright/test";
import assert from "node:assert/strict";
export async function checkAvailabilityUI(page: Page) {
  let rooms: unknown[] = [
    {
      id: "test-room",
      name: "Standard room",
      nightly_rate: 250000,
      cancellation_terms: "Test cancellation terms",
    },
  ];
  await page.route("**/api/availability/suggestions", (route) =>
    route.fulfill({ json: { suggestions: [] } }),
  );
  let status = 200;
  let checkoutEnabled = false;
  await page.route("**/api/availability", (route) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(
        status === 200
          ? { mode: "live", rooms, checkoutEnabled }
          : {
              error:
                "We could not check availability. Please try again shortly.",
            },
      ),
    }),
  );
  await page.goto(
    "http://localhost:3000/book?checkin=2090-10-10&checkout=2090-10-12&adults=2",
  );
  await page
    .getByText("1 room available for your dates.", { exact: true })
    .waitFor();
  assert.match(await page.locator(".booking-form").innerText(), /₹5,000 total/);
  assert.equal(
    await page.getByRole("button", { name: "Prepare email enquiry" }).count(),
    0,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Continue to secure payment" })
      .count(),
    0,
  );
  await page.getByRole("button", { name: "Book now", exact: true }).click();
  await page.getByText(/Online payment is currently unavailable/).waitFor();
  await page.getByRole("button", { name: "Back to availability" }).click();
  console.log(
    "PASS automatic availability and rates without payments or email",
  );
  checkoutEnabled = true;
  await page.getByRole("button", { name: "Check availability" }).click();
  await page.getByRole("button", { name: "Book now", exact: true }).click();
  await page
    .getByRole("button", { name: "Continue to secure payment" })
    .waitFor();
  await page.getByRole("button", { name: "Back to availability" }).click();
  console.log("PASS checkout offered separately when enabled");
  rooms = [];
  await page.getByLabel("Check-out", { exact: true }).fill("2090-10-13");
  assert.equal(
    await page
      .getByRole("button", { name: "Continue to secure payment" })
      .count(),
    0,
  );
  await page.getByRole("button", { name: "Check availability" }).click();
  await page.getByText(/Your selected room option is unavailable/).waitFor();
  console.log("PASS no availability and invalidation after date changes");
  status = 503;
  await page.getByRole("button", { name: "Check availability" }).click();
  await page
    .getByText("We could not check availability. Please try again shortly.", {
      exact: true,
    })
    .waitFor();
  assert.equal(await page.getByText(/No rooms available/).count(), 0);
  console.log("PASS connection errors are distinct from no availability");
  await page.getByLabel("Check-out", { exact: true }).fill("2090-10-09");
  await page.getByRole("button", { name: "Check availability" }).click();
  await page.getByText("Check-out must be after check-in").waitFor();
  await page.unroute("**/api/availability");
  let resolveRequest!: (route: Route) => void;
  const heldRequest = new Promise<Route>((resolve) => {
    resolveRequest = resolve;
  });
  await page.route("**/api/availability", (route) => {
    resolveRequest(route);
  });
  await page.goto(
    "http://localhost:3000/book?checkin=2090-10-10&checkout=2090-10-12&adults=2",
  );
  const route = await heldRequest;
  await page.getByLabel("Check-out", { exact: true }).fill("2090-10-15");
  const completed = page.waitForResponse("**/api/availability");
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      mode: "live",
      rooms: [{ id: "stale", nightly_rate: 1 }],
      checkoutEnabled: true,
    }),
  });
  await completed;
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  assert.equal(
    await page.getByText(/room available for your dates/).count(),
    0,
  );
  await page.unroute("**/api/availability");
  console.log("PASS stale availability responses ignored");
}
if (process.argv[1]?.endsWith("availability-browser.ts")) {
  (async () => {
    const browser = await chromium.launch({
      channel: "msedge",
      headless: true,
    });
    try {
      const page = await browser.newPage();
      await checkAvailabilityUI(page);
    } finally {
      await browser.close();
    }
  })().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
