import { chromium } from "@playwright/test";
import assert from "node:assert/strict";

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      let calls = 0,
        fail = false;
      await page.route("**/api/**", (route) => route.abort());
      await page.route("https://maps.google.com/**", (route) => route.abort());
      await page.route("**/api/contact", (route) => {
        const data = route.request().postDataJSON();
        assert.equal(data.requestType, "cancellation");
        assert.equal(data.bookingReference, "avapart_20901210_R22_1");
        calls++;
        return route.fulfill({
          status: fail ? 503 : 200,
          json: fail
            ? { error: "Unable to send your enquiry." }
            : { ok: true, emailPending: true },
        });
      });
      await page.goto(
        (process.env.TEST_BASE_URL || "http://localhost:3000") +
          "/cancellation-policy",
        { waitUntil: "domcontentloaded", timeout: 60000 },
      );
      await page
        .getByRole("heading", {
          level: 1,
          name: "Reservations & Cancellation Policy",
        })
        .waitFor();
      assert.match(
        await page.locator("article").innerText(),
        /15 or more days before check-in: 10%/,
      );
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page
        .locator("article")
        .getByRole("link", { name: "Request cancellation", exact: true })
        .click();
      const form = page.locator("#contact-form");
      await form.getByLabel("Booking reference", { exact: true }).waitFor();
      assert.equal(
        await form.getByLabel("Request type").inputValue(),
        "cancellation",
      );
      const fill = async () => {
        await form
          .getByLabel("Booking reference", { exact: true })
          .fill("avapart_20901210_R22_1");
        await form.getByLabel("Your name", { exact: true }).fill("Test Guest");
        await form
          .getByLabel("Email", { exact: true })
          .fill("guest@example.com");
        await form
          .getByLabel("Your message", { exact: true })
          .fill("Please cancel my stay, 10–12 December 2090.");
      };
      await fill();
      await form
        .getByRole("button", { name: "Send cancellation request", exact: true })
        .click();
      await form
        .getByRole("status")
        .filter({
          hasText: "Your booking has not been automatically cancelled.",
        })
        .waitFor();
      assert.equal(calls, 1);
      assert.ok(
        !page.url().includes("bookingReference"),
        "Private details stay out of the URL",
      );
      fail = true;
      await fill();
      await form
        .getByRole("button", { name: "Send cancellation request", exact: true })
        .click();
      const fallback = form.getByRole("link", {
        name: "Open your email app with this enquiry",
      });
      await fallback.waitFor();
      assert.match(
        decodeURIComponent((await fallback.getAttribute("href"))!),
        /Cancellation request - avapart_20901210_R22_1/,
      );
      assert.equal(
        await form
          .getByLabel("Booking reference", { exact: true })
          .inputValue(),
        "avapart_20901210_R22_1",
      );
      await form.getByLabel("Request type").selectOption("enquiry");
      await form.getByLabel("Subject", { exact: true }).waitFor();
      assert.equal(
        await form.getByLabel("Booking reference", { exact: true }).count(),
        0,
      );
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      console.log(
        `PASS ${width}px policy, cancellation request, acknowledgement, email fallback and enquiry switch (mocked)`,
      );
      await page.close();
    }
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
