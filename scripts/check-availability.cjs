const { loadEnvConfig } = require("@next/env");
const { createClient } = require("@supabase/supabase-js");
loadEnvConfig(process.cwd());
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log("Supabase configuration is missing.");
    process.exitCode = 1;
    return;
  }
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(15000) }),
    },
  });
  const inventory = await db.from("rooms").select("category,active,capacity");
  if (inventory.error) {
    console.log(
      "Room inventory read failed. Error code: " +
        (inventory.error.code || "connection_failed"),
    );
    process.exitCode = 1;
    return;
  }
  console.log("Configured rooms: " + inventory.data.length);
  for (const category of ["twin", "studio", "family", "triple"])
    console.log(
      category +
        ": " +
        inventory.data.filter((r) => r.category === category && r.active)
          .length +
        " active rooms",
    );
  const start = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    end = new Date(Date.now() + 9 * 86400000).toISOString().slice(0, 10);
  const available = await db.rpc("available_rooms", {
    p_category: "twin",
    p_checkin: start,
    p_checkout: end,
    p_guests: 2,
  });
  if (available.error) {
    console.log(
      "Availability query failed. Error code: " +
        (available.error.code || "connection_failed"),
    );
    process.exitCode = 1;
    return;
  }
  console.log(
    "Live availability RPC succeeded. Available standard rooms for " +
      start +
      " to " +
      end +
      ": " +
      available.data.length,
  );
}
main().catch(() => {
  console.log("Supabase connection check failed.");
  process.exitCode = 1;
});
