import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
async function main() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const user = {
    id: "00000000-0000-4000-8000-000000000001",
    aud: "authenticated",
    role: "authenticated",
    email: "admin-test@example.com",
    app_metadata: { role: "admin", provider: "email" },
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const jwt = (admin: boolean) =>
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ) +
    "." +
    Buffer.from(
      JSON.stringify({
        sub: user.id,
        exp: Math.floor(Date.now() / 1000) + 3600,
        role: "authenticated",
        app_metadata: admin ? { role: "admin" } : {},
      }),
    ).toString("base64url") +
    ".test-signature";
  const stale = jwt(false),
    fresh = jwt(true);
  const session = {
    access_token: stale,
    refresh_token: "test-refresh-token",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: "bearer",
    user: { ...user, app_metadata: { provider: "email" } },
  };
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage();
    const initialRoom = { id: "test-room", name: "Session regression test", room_number: 99, category: "twin", capacity: 2, nightly_rate: 100000, non_season_rate: 100000, season_rate: 150000, active: true, image_url: "/images/twin.jpg", image_urls: ["/images/twin.jpg"], cancellation_terms: "Test only" };
    let fixture: Record<string, unknown>[] = [{...initialRoom}];
    let deleted = 0,
      blockDelete = false;
    let refreshed = 0,
      saved = 0,
      deny = false;
    await page.addInitScript(
      ({ key, session }) => localStorage.setItem(key, JSON.stringify(session)),
      {
        key: "sb-" + new URL(base).hostname.split(".")[0] + "-auth-token",
        session,
      },
    );
    await page.routeWebSocket("**/realtime/**", (socket) => socket.close());
    await page.route(base + "/**", async (route) => {
      const request = route.request(),
        url = new URL(request.url());
      if (url.pathname === "/auth/v1/user")
        return route.fulfill({ status: 200, json: user });
      if (url.pathname === "/auth/v1/token") {
        refreshed++;
        return route.fulfill({
          status: 200,
          json: { ...session, user, access_token: fresh },
        });
      }
      if (url.pathname === "/rest/v1/rooms" && request.method() === "POST") {
        assert.equal(request.headers().authorization, "Bearer " + fresh);
        saved++;
        if (!deny) fixture = [{ ...request.postDataJSON(), id: "test-room" }];
        return deny
          ? route.fulfill({
              status: 403,
              json: {
                code: "42501",
                message: "new row violates row-level security policy",
              },
            })
          : route.fulfill({ status: 201, json: [{ id: "test-room" }] });
      }
      if (url.pathname === "/rest/v1/rooms" && request.method() === "PATCH") {
        saved++;
        if (deny) return route.fulfill({status:403,json:{code:"42501",message:"Denied"}});
        fixture = [{ ...fixture[0], ...request.postDataJSON() }];
        return route.fulfill({ status: 200, json: [{ id: "test-room" }] });
      }
      if (url.pathname === "/rest/v1/rooms" && request.method() === "DELETE") {
        if (blockDelete)
          return route.fulfill({
            status: 409,
            json: { code: "23503", message: "booking foreign key" },
          });
        deleted++;
        fixture = [];
        return route.fulfill({ status: 200, json: [{ id: "test-room" }] });
      }
      if (request.method() === "GET" && url.pathname === "/rest/v1/rooms")
        return route.fulfill({ status: 200, json: fixture });
      if (request.method() === "GET" && url.pathname.startsWith("/rest/v1/"))
        return route.fulfill({ status: 200, json: [] });
      return route.abort();
    });
    await page.goto("http://localhost:3000/admin");
    await page.getByRole("button", { name: "Rooms", exact: true }).click();
    await page.getByRole("button", {name:"Edit Session regression test",exact:true}).click();
    await page.getByLabel("Room name / number").fill("Session regression test");
    await page.getByLabel("Room number", { exact: true }).fill("99");
    await page.getByLabel("Non-season nightly rate (INR)").fill("1000");
    await page
      .getByLabel("Season nightly rate (INR)", { exact: true })
      .fill("1500");
    await page.getByLabel("Cancellation terms").fill("Test only");
    await page.getByRole("button", { name: "Save room", exact: true }).click();
    await page.getByText("Room saved.", { exact: true }).waitFor();
    assert.equal(saved, 1);
    assert.equal(refreshed, 1);
    console.log(
      "PASS stale token refreshed before room PATCH; no live room was changed",
    );
    assert.equal(fixture[0].non_season_rate, 100000);
    assert.equal(fixture[0].season_rate, 150000);
    assert.equal(fixture[0].category, "twin");
    await page
      .getByRole("button", {
        name: "Edit Session regression test",
        exact: true,
      })
      .click();
    await page
      .getByLabel("Add image URLs (one per line)")
      .fill("https://example.com/second.jpg\nhttps://example.com/third.jpg");
    await page.getByRole("button", { name: "Save room", exact: true }).click();
    await page.getByText("Room saved.", { exact: true }).waitFor();
    assert.equal((fixture[0].image_urls as string[]).length, 3);
    await page
      .getByRole("button", {
        name: "Edit Session regression test",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Make cover", exact: true })
      .last()
      .click();
    await page
      .getByRole("button", { name: "Remove photo 2", exact: true })
      .click();
    await page.getByRole("button", { name: "Save room", exact: true }).click();
    await page.getByText("Room saved.", { exact: true }).waitFor();
    assert.deepEqual(fixture[0].image_urls, [
      "https://example.com/third.jpg",
      "https://example.com/second.jpg",
    ]);
    page.on("dialog", () => {
      throw new Error("Unexpected browser popup");
    });
    const openDelete = () =>
      page
        .getByRole("button", {
          name: "Delete Session regression test",
          exact: true,
        })
        .click();
    const modal = page.getByRole("dialog");
    await openDelete();
    await modal.waitFor();
    assert.equal(
      await modal
        .getByRole("button", { name: "Cancel", exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.keyboard.press("Escape");
    await modal.waitFor({ state: "hidden" });
    assert.equal(deleted, 0);
    await openDelete();
    await modal.getByRole("button", { name: "Cancel", exact: true }).click();
    await modal.waitFor({ state: "hidden" });
    assert.equal(deleted, 0);
    blockDelete = true;
    await openDelete();
    await modal
      .getByRole("button", { name: "Delete room", exact: true })
      .click();
    await modal
      .getByRole("alert")
      .filter({ hasText: "This room has booking history" })
      .waitFor();
    assert.equal(deleted, 0);
    await page.setViewportSize({ width: 390, height: 844 });
    const bounds = await modal.boundingBox();
    assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 390);
    await page.screenshot({ path: "artifacts/delete-room-mobile.png" });
    blockDelete = false;
    await modal
      .getByRole("button", { name: "Delete room", exact: true })
      .click();
    await modal.waitFor({ state: "hidden" });
    await page.getByText("Room deleted.", { exact: true }).waitFor();
    assert.equal(deleted, 1);
    console.log(
      "PASS multiple images, cover selection, gallery removal, protected deletion and successful deletion",
    );
    fixture = [{...initialRoom}];
    await page.reload();
    await page.getByRole("button", {name:"Rooms",exact:true}).click();
    await page.getByRole("button", {name:"Edit Session regression test",exact:true}).click();
    deny = true;
    await page.getByLabel("Room name / number").fill("Denied test");
    await page.getByLabel("Room number", { exact: true }).fill("99");
    await page.getByLabel("Non-season nightly rate (INR)").fill("1000");
    await page
      .getByLabel("Season nightly rate (INR)", { exact: true })
      .fill("1500");
    await page.getByLabel("Cancellation terms").fill("Test only");
    await page.getByRole("button", { name: "Save room", exact: true }).click();
    await page.getByText(/Room save denied by the database/).waitFor();
    assert.equal(
      await page.getByLabel("Room name / number").inputValue(),
      "Denied test",
    );
    console.log(
      "PASS denied saves show actionable errors and preserve the form",
    );
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
