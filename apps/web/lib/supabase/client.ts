import { createBrowserClient } from "@supabase/ssr";

/** Browser Supabase client (publishable key only). Used for realtime subscriptions; all writes stay on the server. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
