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
  await page.goto(
    "http://localhost:3000/book?checkin=2090-10-10&checkout=2090-10-12&adults=2",
  );
  await page.getByRole("button", { name: "Check availability" }).click();
  await page.getByText("Your details", { exact: true }).last().waitFor();
  await page.getByLabel("First name").fill("Test");
  await page.getByLabel("Last name").fill("Guest");
  await page.getByLabel("Email", { exact: true }).fill("guest@example.com");
  await page.getByLabel("Phone", { exact: true }).fill("9999999999");
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Prepare email enquiry" }).click();
  assert.ok(
    (
      await page
        .getByRole("link", { name: "Open email and send enquiry" })
        .getAttribute("href")
    )?.startsWith("mailto:"),
  );
  console.log("PASS booking enquiry fallback");
  await page.getByLabel("Check-out", { exact: true }).fill("2090-10-09");
  await page.getByRole("button", { name: "Check availability" }).click();
  await page.getByText("Check-out must be after check-in").waitFor();
  console.log("PASS invalid date protection");
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
