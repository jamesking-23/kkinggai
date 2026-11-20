"use server";

import { sanitizePrefs, type BoardPrefs } from "../../../lib/board-prefs";
import { extractBoard, withBoard, type SyncedBoard } from "../../../lib/board-sync";
import { getAppContext } from "../../../lib/session";
import type { Json } from "../../../lib/supabase/database.types";
import { createClient } from "../../../lib/supabase/server";

/** The signed-in user's saved board look, or null if none was ever saved. */
export async function loadBoardPrefs(): Promise<SyncedBoard | null> {
  const ctx = await getAppContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_settings")
    .select("settings")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  return extractBoard(data?.settings);
}

/** Saves the board look into the user's own settings row, keeping every other setting. Returns whether it saved. */
export async function saveBoardPrefs(prefs: BoardPrefs, at: number): Promise<boolean> {
  if (!Number.isFinite(at) || at <= 0 || at > Date.now() + 5 * 60_000) return false;
  const ctx = await getAppContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_settings")
    .select("settings")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  const current = extractBoard(data?.settings);
  if (current && current.at >= at) return false; // a newer save already exists
  const { data: updated, error } = await supabase
    .from("user_settings")
    .update({ settings: withBoard(data?.settings, sanitizePrefs(prefs), at) as Json })
    .eq("user_id", ctx.userId)
    .select("user_id");
  return !error && !!updated && updated.length > 0;
}
