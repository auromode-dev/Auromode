import type { SupabaseClient } from "@supabase/supabase-js";
type AdminAuth = Pick<
  SupabaseClient["auth"],
  "getUser" | "getSession" | "refreshSession"
>;
type AdminAccess = { authorized: boolean; error: string | null };
const checks = new WeakMap<AdminAuth, Promise<AdminAccess>>();
// Used only to detect stale claims. Supabase RLS verifies the token and authorizes writes.
function tokenHasAdminRole(token: string) {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload)).app_metadata?.role === "admin";
  } catch {
    return false;
  }
}
async function checkAccess(auth: AdminAuth): Promise<AdminAccess> {
  try {
    const {
      data: { user },
      error,
    } = await auth.getUser();
    if (error || !user)
      return {
        authorized: false,
        error: "Your session has expired. Please sign in again.",
      };
    if (user.app_metadata?.role !== "admin")
      return {
        authorized: false,
        error:
          "This account does not have reception access. Ask the project administrator to assign the admin role.",
      };
    const {
      data: { session },
      error: sessionError,
    } = await auth.getSession();
    if (sessionError || !session)
      return {
        authorized: false,
        error: "Your session has expired. Please sign in again.",
      };
    if (tokenHasAdminRole(session.access_token))
      return { authorized: true, error: null };
    const refreshed = await auth.refreshSession();
    if (refreshed.error || !refreshed.data.session)
      return {
        authorized: false,
        error:
          "Your admin session could not be refreshed. Please sign out and sign in again.",
      };
    if (!tokenHasAdminRole(refreshed.data.session.access_token))
      return {
        authorized: false,
        error:
          "Your session does not include admin access. Please sign out and sign in again.",
      };
    return { authorized: true, error: null };
  } catch {
    return {
      authorized: false,
      error: "Unable to verify admin access. Please try signing in again.",
    };
  }
}
export async function ensureAdminSession(
  auth: AdminAuth,
): Promise<AdminAccess> {
  const existing = checks.get(auth);
  if (existing) return existing;
  const check = checkAccess(auth);
  checks.set(auth, check);
  try {
    return await check;
  } finally {
    checks.delete(auth);
  }
}
export function roomSaveError(code?: string) {
  if (code === "42501")
    return "Room save denied by the database. Please sign out and sign in again. If this continues, check the admin access policies in Supabase.";
  if (code === "23514" || code === "23502")
    return "Check the room name, category, capacity, nightly rate, and cancellation terms.";
  return "Room could not be saved. Please try again.";
}
