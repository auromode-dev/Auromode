import test from "node:test";
import assert from "node:assert/strict";
import { ensureAdminSession, roomSaveError } from "../lib/admin-session";
type AdminAuth = Parameters<typeof ensureAdminSession>[0];
const token = (role?: string) =>
  "header." +
  Buffer.from(JSON.stringify({ app_metadata: role ? { role } : {} })).toString(
    "base64url",
  ) +
  ".signature";
function fixture(
  options: {
    accountRole?: string;
    tokenRole?: string;
    refreshedRole?: string;
    refreshFails?: boolean;
    invalidToken?: boolean;
  } = {},
) {
  let refreshCalls = 0;
  const auth = {
    getUser: async () => ({
      data: {
        user: { app_metadata: { role: options.accountRole ?? "admin" } },
      },
      error: null,
    }),
    getSession: async () => ({
      data: {
        session: {
          access_token: options.invalidToken ? "bad" : token(options.tokenRole),
        },
      },
      error: null,
    }),
    refreshSession: async () => {
      refreshCalls++;
      return options.refreshFails
        ? { data: { session: null }, error: new Error("Refresh failed") }
        : {
            data: {
              session: {
                access_token: token(options.refreshedRole ?? "admin"),
              },
            },
            error: null,
          };
    },
  } as unknown as AdminAuth;
  return {
    auth,
    get refreshCalls() {
      return refreshCalls;
    },
  };
}
test("refreshes an admin account whose token still lacks the role", async () => {
  const f = fixture();
  assert.deepEqual(await ensureAdminSession(f.auth), {
    authorized: true,
    error: null,
  });
  assert.equal(f.refreshCalls, 1);
});
test("does not refresh an already current admin token", async () => {
  const f = fixture({ tokenRole: "admin" });
  assert.equal((await ensureAdminSession(f.auth)).authorized, true);
  assert.equal(f.refreshCalls, 0);
});
test("denies non-admin accounts even when the cached token says admin", async () => {
  const f = fixture({ accountRole: "guest", tokenRole: "admin" });
  assert.equal((await ensureAdminSession(f.auth)).authorized, false);
  assert.equal(f.refreshCalls, 0);
});
test("failed refresh blocks access rather than using stale credentials", async () => {
  const f = fixture({ refreshFails: true });
  const result = await ensureAdminSession(f.auth);
  assert.equal(result.authorized, false);
  assert.match(result.error!, /sign out and sign in/);
});
test("fresh tokens must actually contain the admin claim", async () => {
  const f = fixture({ refreshedRole: "guest" });
  assert.equal((await ensureAdminSession(f.auth)).authorized, false);
});
test("concurrent checks share one refresh operation", async () => {
  const f = fixture();
  const results = await Promise.all([
    ensureAdminSession(f.auth),
    ensureAdminSession(f.auth),
  ]);
  assert.ok(results.every((r) => r.authorized));
  assert.equal(f.refreshCalls, 1);
});
test("malformed tokens are refreshed instead of throwing", async () => {
  const f = fixture({ invalidToken: true });
  assert.equal((await ensureAdminSession(f.auth)).authorized, true);
  assert.equal(f.refreshCalls, 1);
});
test("permission errors give an actionable room-save message", () => {
  assert.match(roomSaveError("42501"), /sign out and sign in/);
  assert.match(roomSaveError("23514"), /capacity/);
});
