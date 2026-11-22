// Public values only. The Supabase "publishable" key is designed to ship inside client apps; access is controlled by
// row-level security. Never put a service-role key, an AI key or any other secret in this app.
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const configured =
  SUPABASE_URL.startsWith("https://") && SUPABASE_PUBLISHABLE_KEY.length > 0;

// Set by the Android workflow to the GitHub run number; 0 for local or development builds.
export const BUILD_NUMBER = process.env.EXPO_PUBLIC_BUILD_NUMBER ?? "";
