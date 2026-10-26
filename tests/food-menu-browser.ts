import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage();
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const room of ["studio", "twin", "triple", "family"]) {
        await page.goto(`http://localhost:3000/book?room=${room}`);
        const trigger = page.getByRole("button", { name: "Food menu", exact: true });
        const dialog = page.getByRole("dialog", { name: "Food menu" });
        await expect(async () => {
          if (!(await dialog.isVisible())) await trigger.click();
          await expect(dialog).toBeVisible({ timeout: 1000 });
        }).toPass({ timeout: 10000 });
        await expect(page.getByRole("button", { name: "Close menu", exact: true })).toBeFocused();
        await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
        const img = dialog.locator(".food-menu-image img");
        for (const [index, file] of ["IMG_0558", "IMG_0559", "IMG_0557"].entries()) {
          await dialog.getByRole("button", { name: `Menu page ${index + 1}`, exact: true }).click();
          await expect(img).toHaveAttribute("src", `/stay/menu/${file}.webp`);
          await expect.poll(() => img.evaluate((node) => (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0)).toBe(true);
        }
        await dialog.getByRole("button", { name: "Zoom in", exact: true }).click();
        assert.ok(await dialog.locator(".food-menu-image").evaluate((el) => el.scrollWidth > el.clientWidth));
        await dialog.getByRole("button", { name: "Zoom out", exact: true }).click();
        await page.keyboard.press("Escape");
        await expect(dialog).not.toBeVisible();
        await expect(trigger).toBeFocused();
        await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
        await trigger.click();
        await dialog.getByRole("button", { name: "Close menu", exact: true }).click();
        await expect(dialog).not.toBeVisible();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        console.log(`PASS ${room} menu: pages, zoom, dismissal and focus at ${width}px`);
      }
    }
  } finally {
    await browser.close();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
