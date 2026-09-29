import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    await page.goto("http://localhost:3000/guesthouse");
    await page
      .getByRole("heading", { name: "Studio Suite", exact: true })
      .waitFor();
    for (const name of [
      "Studio Suite",
      "Twin Room",
      "Triple Room",
      "Family Suite",
    ])
      await page.getByRole("heading", { name, exact: true }).waitFor();
    const photos = page.locator(".room-gallery > img");
    assert.equal(await photos.count(), 4);
    for (let i = 0; i < 4; i++) {
      await photos.nth(i).scrollIntoViewIfNeeded();
      await photos.nth(i).evaluate(
        (img) =>
          new Promise<void>((resolve, reject) => {
            const i = img as HTMLImageElement;
            if (i.complete)
              return i.naturalWidth
                ? resolve()
                : reject(new Error("Photo failed"));
            i.onload = () => resolve();
            i.onerror = () => reject(new Error("Photo failed"));
          }),
      );
    }
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    );
    console.log(
      "PASS four supplied room photos load; mobile page has no horizontal overflow",
    );
    await page.screenshot({
      path: "artifacts/rooms-mobile.png",
      fullPage: true,
    });
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
