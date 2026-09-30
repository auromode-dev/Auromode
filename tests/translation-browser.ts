import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    const submitted: string[] = [];
    let fail = false;
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/translate", (route) => {
      const { language, texts } = route.request().postDataJSON();
      submitted.push(...texts);
      return route.fulfill({
        status: fail ? 503 : 200,
        json: fail
          ? { error: "Translation unavailable. Showing English." }
          : {
              translations: texts.map(
                (text: string) => `[${language}] ${text}`,
              ),
            },
      });
    });
    const choose = async (name: string) => {
      await page.locator(".language-trigger").click();
      await page
        .locator(".language-options")
        .getByRole("button")
        .filter({ hasText: name })
        .click();
    };
    await page.goto("http://localhost:3000/amenities/offices");
    const english = await page.locator("h1").innerText();
    await page.locator(".language-trigger").click();
    assert.equal(await page.locator(".language-options button").count(), 10);
    for (const img of await page.locator(".language-options img").all())
      assert.ok(
        await img.evaluate(
          (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
        ),
      );
    await page.keyboard.press("Escape");
    await choose("French");
    await page.waitForFunction(() => document.documentElement.lang === "fr");
    assert.match(await page.locator("h1").innerText(), /^\[fr\]/);
    await choose("English");
    await page.waitForFunction(() => document.documentElement.lang === "en");
    assert.equal(await page.locator("h1").innerText(), english);
    await page.goto("http://localhost:3000/contact");
    await page.locator('input[name="name"]').fill("Private Guest Name");
    await page.locator('input[name="email"]').fill("private@example.com");
    await page.locator("textarea").fill("Private travel plans");
    await choose("Tamil");
    await page.waitForFunction(() => document.documentElement.lang === "ta");
    assert.equal(
      await page.locator('input[name="name"]').inputValue(),
      "Private Guest Name",
    );
    assert.ok(
      !submitted.some((text) =>
        /Private Guest Name|private@example.com|Private travel plans/.test(
          text,
        ),
      ),
    );
    await page.goto("http://localhost:3000/amenities");
    await page.waitForFunction(() => document.documentElement.lang === "ta");
    assert.match(await page.locator("h1").innerText(), /^\[ta\]/);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator(".language-trigger").click();
    const bounds = await page.locator(".language-options").boundingBox();
    assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 390);
    await page.screenshot({ path: "artifacts/language-picker-mobile.png" });
    await page.keyboard.press("Escape");
    await page.route("**/api/availability", (route) =>
      route.fulfill({
        json: {
          mode: "live",
          checkoutEnabled: true,
          rooms: [
            {
              id: "room-test",
              name: "Twin",
              nightly_rate: 200000,
              cancellation_terms: "Test terms",
            },
          ],
        },
      }),
    );
    await page.goto(
      "http://localhost:3000/book?checkin=2090-10-10&checkout=2090-10-12&adults=2",
    );
    await page.getByRole("button", { name: /Book now/ }).waitFor();
    await page.getByRole("button", { name: /Book now/ }).click();
    await page.locator('input[name="firstName"]').fill("Private Booking Guest");
    await choose("Spanish");
    await page.waitForFunction(() => document.documentElement.lang === "es");
    assert.equal(
      await page.locator('input[name="firstName"]').inputValue(),
      "Private Booking Guest",
    );
    await page.getByRole("button", { name: /Back to availability/ }).click();
    await page.getByRole("button", { name: /Check availability/ }).click();
    await page.getByRole("button", { name: /Book now/ }).waitFor();
    assert.ok(
      !submitted.some((text) => text.includes("Private Booking Guest")),
    );
    fail = true;
    await choose("German");
    await page
      .getByText("Translation unavailable. Showing English.", { exact: false })
      .waitFor();
    assert.equal(await page.locator("html").getAttribute("lang"), "en");
    assert.ok(!(await page.locator("h1").innerText()).startsWith("["));
    assert.deepEqual(errors, []);
    console.log(
      "PASS ten flags, public-page translation, English restore, navigation persistence, private fields, mobile menu and unavailable-provider fallback",
    );
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
