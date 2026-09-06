import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Sync is optional. With no Supabase project configured the app is exactly what
 * it was before accounts existed — a local-only closet — so every caller has to
 * cope with `null` rather than assuming a client.
 */
export const cloudConfigured = Boolean(URL && ANON_KEY);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!cloudConfigured) return null;
  if (typeof window === "undefined") return null;
  if (!client) {
    client = createClient(URL!, ANON_KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}

export const PHOTO_BUCKET = "wardrobe";

/** Storage object name for a photo. The leading segment is the RLS owner check. */
export function photoPath(userId: string, imageId: string) {
  return `${userId}/${imageId}`;
}
