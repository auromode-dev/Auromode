import { createClient, SupabaseClient } from "@supabase/supabase-js";
let client: SupabaseClient | null = null;
export function browserDatabase() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  client = createClient(url, key);
  return client;
}
