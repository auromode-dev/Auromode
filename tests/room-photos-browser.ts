import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { expect } from "@playwright/test";
import { roomPhotos } from "../lib/room-photos";
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
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("http://localhost:3000/book?room=twin", { waitUntil: "domcontentloaded" });
      const gallery = page.locator(".booking-room-gallery");
      for (const category of ["twin", "studio", "triple", "family"] as const) {
        await page.getByLabel("Room type").selectOption(category);
        const images = roomPhotos[category];
        const main = gallery.locator(".room-gallery > img");
        await expect(main).toHaveAttribute("src", images[0]);
        await gallery.scrollIntoViewIfNeeded();
        await expect(main).toBeVisible();
        await expect.poll(() => main.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
        await expect(gallery.locator(".gallery-thumbnails button")).toHaveCount(images.length);
        await expect(gallery.locator(".gallery-next, .gallery-prev")).toHaveCount(0);
        await gallery.locator(".gallery-thumbnails button").nth(1).click();
        await expect(main).toHaveAttribute("src", images[1]);
        await gallery.locator(".gallery-thumbnails button").first().click();
        await expect(main).toHaveAttribute("src", images[0]);
        await gallery.locator(".gallery-thumbnails button").last().click();
        await expect(main).toHaveAttribute("src", images.at(-1)!);
        await expect.poll(() => main.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
        assert.ok(await gallery.evaluate((el) => el.getBoundingClientRect().top >= document.querySelector(".booking-layout")!.getBoundingClientRect().bottom));
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        console.log(`PASS ${category} gallery, category switching and controls at ${width}px`);
      }
      await page.screenshot({ path: `artifacts/booking-gallery-${width}.png` });
    }
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
