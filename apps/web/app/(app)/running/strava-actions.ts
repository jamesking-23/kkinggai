"use server";

import { revalidatePath } from "next/cache";
import { flash } from "../../../lib/form";
import {
  fetchActivitiesPage,
  mapActivity,
  needsRefresh,
  refreshTokens,
  StravaError,
  type RunRow,
} from "../../../lib/strava";
import { getAppContext } from "../../../lib/session";
import { createClient } from "../../../lib/supabase/server";

const PATH = "/running";
const MAX_PAGES = 5;
const FIRST_SYNC_DAYS = 365;
const OVERLAP_DAYS = 2; // late uploads can have an older start time than the last sync

export async function syncStrava() {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) flash(PATH, "error", "Strava is not configured on the server");

  const ctx = await getAppContext();
  const supabase = await createClient();
  const { data: conn } = await supabase
    .from("strava_connections")
    .select("access_token, refresh_token, expires_at, last_synced_at")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (!conn) flash(PATH, "error", "Connect Strava first");

  let imported = 0;
  let checked = 0;
  let complete = false;
  try {
    let access = conn!.access_token;
    if (needsRefresh(new Date(conn!.expires_at), new Date())) {
      const t = await refreshTokens(fetch, {
        clientId: clientId!,
        clientSecret: clientSecret!,
        refreshToken: conn!.refresh_token,
      });
      access = t.accessToken;
      const { error } = await supabase
        .from("strava_connections")
        .update({
          access_token: t.accessToken,
          refresh_token: t.refreshToken,
          expires_at: t.expiresAt.toISOString(),
        })
        .eq("user_id", ctx.userId);
      if (error) throw new StravaError("Could not save refreshed Strava tokens.");
    }

    const since = conn!.last_synced_at
      ? new Date(conn!.last_synced_at).getTime() - OVERLAP_DAYS * 86_400_000
      : Date.now() - FIRST_SYNC_DAYS * 86_400_000;
    const after = Math.floor(since / 1000);

    const rows: RunRow[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const acts = await fetchActivitiesPage(fetch, access, after, page);
      checked += acts.length;
      for (const a of acts) {
        const r = mapActivity(a);
        if (r) rows.push(r);
      }
      if (acts.length < 100) {
        complete = true;
        break;
      }
    }

    if (rows.length > 0) {
      const ids = rows.map((r) => r.external_id);
      const have = new Set<string>();
      for (let i = 0; i < ids.length; i += 100) {
        const { data } = await supabase
          .from("run_activities")
          .select("external_id")
          .eq("source", "strava")
          .is("deleted_at", null)
          .in("external_id", ids.slice(i, i + 100));
        for (const d of data ?? []) if (d.external_id) have.add(d.external_id);
      }
      const fresh = rows.filter((r) => !have.has(r.external_id));
      for (let i = 0; i < fresh.length; i += 100) {
        const { error } = await supabase.from("run_activities").insert(fresh.slice(i, i + 100));
        if (error) throw new StravaError("Could not save the imported runs.");
      }
      imported = fresh.length;
    }
    // Only advance the sync point after a complete pass, so a capped run is retried rather than skipped.
    if (complete) {
      await supabase
        .from("strava_connections")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("user_id", ctx.userId);
    }
  } catch (e) {
    flash(PATH, "error", e instanceof StravaError ? e.message : "Strava sync failed.");
  }

  revalidatePath(PATH);
  flash(
    PATH,
    "message",
    `Strava: ${imported} new run${imported === 1 ? "" : "s"} imported (${checked} activities checked)${
      complete ? "" : `. Stopped after ${MAX_PAGES * 100} activities; sync again to continue`
    }`,
  );
}

export async function disconnectStrava() {
  const ctx = await getAppContext();
  const supabase = await createClient();
  const { data: conn } = await supabase
    .from("strava_connections")
    .select("access_token")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (conn) {
    // Best effort: tell Strava to revoke the token. A failure here must not block removing it locally.
    try {
      await fetch("https://www.strava.com/oauth/deauthorize", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ access_token: conn.access_token }).toString(),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      /* ignored */
    }
  }
  const { error } = await supabase.from("strava_connections").delete().eq("user_id", ctx.userId);
  if (error) flash(PATH, "error", "Could not disconnect Strava");
  revalidatePath(PATH);
  flash(PATH, "message", "Strava disconnected. Runs you already imported are kept.");
}
