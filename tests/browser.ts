import { checkAvailabilityUI } from "./availability-browser";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await mkdir("artifacts", { recursive: true });
  for (const route of [
    "/",
    "/about",
    "/guesthouse",
    "/amenities",
    "/amenities/hive",
    "/amenities/tanto",
    "/amenities/to-be-two",
    "/explore",
    "/contact",
    "/book",
    "/admin",
    "/fr",
    "/ta",
  ]) {
    const response = await page.goto("http://localhost:3000" + route);
    assert.equal(response?.status(), 200, route);
    await page.locator("h1").waitFor();
    console.log("PASS route " + route);
  }
  await page.goto("http://localhost:3000/");
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images).map(async (img) => {
        img.loading = "eager";
        await img.decode();
      }),
    );
  });
  await page.screenshot({ path: "artifacts/home-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Next photo" }).click();
  assert.ok(
    (await page.locator(".hero-image").getAttribute("src"))?.includes("garden"),
  );
  await page.getByRole("button", { name: "Previous photo" }).click();
  console.log("PASS hero carousel");
  const imageResults = await page.locator("img").evaluateAll((imgs) =>
    imgs.map((node) => {
      const img = node as HTMLImageElement;
      return { src: img.src, loaded: img.complete && img.naturalWidth > 0 };
    }),
  );
  assert.ok(imageResults.every((image) => image.loaded));
  console.log("PASS local photography");
  await checkAvailabilityUI(page);
  await page.route("**/api/contact", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Enquiry service unavailable in this test.",
      }),
    }),
  );
  await page.goto("http://localhost:3000/contact");
  await page.getByLabel("Your name").fill("Test Guest");
  await page.getByLabel("Email", { exact: true }).fill("guest@example.com");
  await page.getByLabel("Subject").fill("Test enquiry");
  await page
    .getByLabel("Your message")
    .fill("Hello, I would like room availability.");
  await page.getByRole("button", { name: "Send your enquiry" }).click();
  await page
    .getByRole("link", { name: "Open your email app with this enquiry" })
    .waitFor();
  console.log("PASS contact fallback");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3000/");
  await page.getByLabel("Language").selectOption("fr");
  await page.waitForURL("**/fr");
  await page
    .getByText("Un lieu où séjourner. Un espace pour être soi.", {
      exact: true,
    })
    .waitFor();
  await page.getByLabel("Language").selectOption("en");
  await page.waitForURL("http://localhost:3000/");
  console.log("PASS language navigation");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Our Story" })
    .click();
  await page.waitForURL("**/about");
  assert.equal(
    await page
      .getByRole("button", { name: "Open menu" })
      .getAttribute("aria-expanded"),
    "false",
  );
  console.log("PASS mobile navigation");
  for (const route of ["/", "/guesthouse", "/book", "/contact", "/fr", "/ta"]) {
    await page.goto("http://localhost:3000" + route);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
      "Mobile overflow " + route,
    );
  }
  await page.goto("http://localhost:3000/");
  await page.screenshot({ path: "artifacts/home-mobile.png", fullPage: true });
  assert.deepEqual(errors, []);
  console.log("PASS mobile layout and browser errors");
  await browser.close();
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
