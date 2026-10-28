import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { languages } from "../lib/languages";
import { loadDictionary, translateStored } from "../lib/stored-translations";

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const errors: string[] = [];
    const translationRequests: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/translate", (route) => {
      translationRequests.push(route.request().url());
      return route.abort();
    });
    await page.route("**/*microsofttranslator.com/**", (route) => {
      translationRequests.push(route.request().url());
      return route.abort();
    });
    const choose = async (name: string) => {
      await page.waitForFunction(() =>
        Object.keys(document.querySelector(".language-trigger") || {}).some(
          (key) => key.startsWith("__reactProps"),
        ),
      );
      await page.locator(".language-trigger").click();
      await page
        .locator(".language-options button")
        .filter({ hasText: name })
        .click();
    };
    await page.goto(
      (process.env.TEST_BASE_URL || "http://localhost:3000") +
        "/amenities/offices",
      {
        waitUntil: "domcontentloaded",
      },
    );
    const english = "A quieter place for your next big idea.";
    await page.locator("h1").filter({ hasText: english }).waitFor();
    for (const language of languages.filter((l) => l.code !== "en")) {
      await choose(language.name);
      const dictionary = await loadDictionary(language.code);
      await page.waitForFunction(
        (code) => document.documentElement.lang === code,
        language.code,
      );
      assert.equal(await page.locator("h1").innerText(), dictionary[english]);
    }
    await choose("English");
    assert.equal(await page.locator("h1").innerText(), english);

    // Audit initial public content against the actual stored dictionary.
    const dictionary = await loadDictionary("fr");
    const uncovered = new Set<string>();
    for (const path of [
      "/",
      "/about",
      "/guesthouse",
      "/amenities",
      "/amenities/hive",
      "/amenities/tanto",
      "/amenities/to-be-two",
      "/amenities/offices",
      "/explore",
      "/contact",
      "/availability",
      "/book",
    ]) {
      await page.goto(
        (process.env.TEST_BASE_URL || "http://localhost:3000") +
          "" +
          path +
          "?lang=en",
        {
          waitUntil: "domcontentloaded",
        },
      );
      await page.locator("h1").waitFor();
      const texts = await page.evaluate(() => {
        const excluded =
          'script,style,noscript,title,textarea,code,pre,[translate="no"],[data-private],[contenteditable="true"]';
        const result: string[] = [];
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
        );
        let node: Node | null;
        while ((node = walker.nextNode())) {
          if (!node.parentElement?.closest(excluded))
            result.push(node.textContent || "");
        }
        for (const el of document.body.querySelectorAll(
          "[placeholder],[aria-label],[alt],[title]",
        )) {
          if (!el.closest(excluded.replace("textarea,", ""))) {
            for (const attr of ["placeholder", "aria-label", "alt", "title"])
              result.push(el.getAttribute(attr) || "");
          }
        }
        return [
          ...new Set(
            result
              .map((t) => t.replace(/\s+/g, " ").trim())
              .filter(
                (t) =>
                  t &&
                  t.length <= 3000 &&
                  /\p{L}/u.test(t) &&
                  !/@|https?:|[0-9a-f]{8}-[0-9a-f-]{27,}|\d{7,}/i.test(t),
              ),
          ),
        ];
      });
      for (const text of texts) {
        if (
          !Object.hasOwn(dictionary, text) &&
          translateStored(text, dictionary) === text
        )
          uncovered.add(path + ": " + text);
      }
    }
    assert.deepEqual(
      [...uncovered],
      [],
      "Public text missing from the stored catalog",
    );

    await page.goto(
      (process.env.TEST_BASE_URL || "http://localhost:3000") +
        "/contact?lang=en",
      {
        waitUntil: "domcontentloaded",
      },
    );
    await page.locator('input[name="name"]').fill("Private Guest Name");
    await page.locator('input[name="email"]').fill("private@example.com");
    await page.locator("textarea").fill("Private travel plans");
    await page.evaluate(() => {
      const privateNode = document.createElement("p");
      privateNode.dataset.private = "";
      privateNode.id = "privacy-fixture";
      privateNode.textContent = "Book now";
      document.body.append(privateNode);
      const unknown = document.createElement("p");
      unknown.id = "unknown-fixture";
      unknown.textContent = "New unpublished copy must stay in English.";
      document.body.append(unknown);
    });
    await choose("Tamil");
    await page.waitForFunction(() => document.documentElement.lang === "ta");
    assert.equal(
      await page.locator('input[name="name"]').inputValue(),
      "Private Guest Name",
    );
    assert.equal(
      await page.locator("textarea").inputValue(),
      "Private travel plans",
    );
    assert.equal(
      await page.locator("#privacy-fixture").innerText(),
      "Book now",
    );
    assert.equal(
      await page.locator("#unknown-fixture").innerText(),
      "New unpublished copy must stay in English.",
    );

    await page.goto(
      (process.env.TEST_BASE_URL || "http://localhost:3000") + "/amenities",
      {
        waitUntil: "domcontentloaded",
      },
    );
    await page.waitForFunction(() => document.documentElement.lang === "ta");
    assert.equal(
      await page.locator("h1").innerText(),
      (await loadDictionary("ta"))["One campus. Your kind of everyday."],
    );
    await page.screenshot({ path: "artifacts/stored-translation-desktop.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForFunction(() =>
      Object.keys(document.querySelector(".language-trigger") || {}).some(
        (key) => key.startsWith("__reactProps"),
      ),
    );
    await page.locator(".language-trigger").click();
    assert.equal(await page.locator(".language-options button").count(), 10);
    const bounds = await page.locator(".language-options").boundingBox();
    assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 390);
    for (const img of await page.locator(".language-options img").all())
      assert.ok(
        await img.evaluate(async (el: HTMLImageElement) => {
          await el.decode();
          return el.naturalWidth > 0;
        }),
      );
    await page.screenshot({ path: "artifacts/stored-translation-mobile.png" });
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
              total_amount: 400000,
              cancellation_terms:
                "Please contact reception for cancellation terms.",
            },
          ],
        },
      }),
    );
    await page.goto(
      (process.env.TEST_BASE_URL || "http://localhost:3000") +
        "/book?lang=es&checkin=2090-10-10&checkout=2090-10-12&adults=2",
      { waitUntil: "domcontentloaded" },
    );
    await page.getByRole("button", { name: "Reservar ahora" }).click();
    await page.locator('input[name="firstName"]').fill("Private Booking Guest");
    await choose("French");
    await page.waitForFunction(() => document.documentElement.lang === "fr");
    assert.equal(
      await page.locator('input[name="firstName"]').inputValue(),
      "Private Booking Guest",
    );
    await page
      .getByRole("button", { name: "Retour aux disponibilités" })
      .click();
    await page
      .getByRole("button", { name: "Vérifier les disponibilités" })
      .click();
    await page.getByRole("button", { name: "Réserver maintenant" }).waitFor();
    await choose("English");
    await page.getByRole("button", { name: "Book now" }).waitFor();

    await page.goto(
      (process.env.TEST_BASE_URL || "http://localhost:3000") + "/admin?lang=fr",
      {
        waitUntil: "domcontentloaded",
      },
    );
    await page.waitForFunction(() => document.documentElement.lang === "en");
    assert.deepEqual(
      translationRequests,
      [],
      "Translation must never submit page text",
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS nine stored languages, public-content coverage, navigation, English restoration, private values, dynamic booking controls, desktop/mobile menus and zero translation requests",
    );
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
