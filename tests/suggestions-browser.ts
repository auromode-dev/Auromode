import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage();
    let selectedQuantity = 0;
    await page.route("**/api/availability", (route) => {
      const stay = route.request().postDataJSON();
      selectedQuantity = Number(stay.quantity);
      return route.fulfill({
        json: {
          mode: "live",
          checkoutEnabled: true,
          rooms:
            stay.room === "twin"
              ? [
                  {
                    id: "1",
                    name: "Twin A",
                    nightly_rate: 200000,
                    cancellation_terms: "Test terms",
                  },
                  {
                    id: "2",
                    name: "Twin B",
                    nightly_rate: 250000,
                    cancellation_terms: "Test terms",
                  },
                ]
              : [],
        },
      });
    });
    await page.route("**/api/availability/suggestions", (route) =>
      route.fulfill({
        json: {
          suggestions: [
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
          ],
        },
      }),
    );
    await page.goto(
      "http://localhost:3000/availability?adults=4&checkin=2090-10-10&checkout=2090-10-12",
    );
    await page.getByRole("heading", { name: "Other ways to stay." }).waitFor();
    assert.equal(
      await page.getByLabel("First name", { exact: true }).count(),
      0,
    );
    await page.getByText("INR 9,000 total", { exact: false }).waitFor();
    await page
      .getByRole("button", { name: "Check this option" })
      .first()
      .click();
    await page.getByRole("button", { name: "Book now", exact: true }).waitFor();
    assert.equal(selectedQuantity, 2);
    assert.match(
      await page.locator(".booking-form").innerText(),
      /9,000 total/,
    );
    await page.getByRole("button", { name: "Book now", exact: true }).click();
    await page.getByLabel("First name", { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Continue to secure payment" })
      .waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    console.log(
      "PASS sold-out family suggests two twins and nearby dates; selection rechecks inventory; Book now opens details; mobile layout fits",
    );
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
