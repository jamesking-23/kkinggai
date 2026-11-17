"use server";

import { revalidatePath } from "next/cache";
import { feedSchema, newsItemStateSchema } from "@kkingg/schemas";
import { FeedError, fetchFeed } from "../../../lib/feeds";
import { firstIssue, flash } from "../../../lib/form";
import { createClient } from "../../../lib/supabase/server";

const PATH = "/news";
const STALE = "This item was changed elsewhere. Reload and try again.";

type Db = Awaited<ReturnType<typeof createClient>>;

/** Fetches one feed and stores new items. Returns how many were new, or throws FeedError. */
async function refresh(db: Db, feedId: string, url: string): Promise<number> {
  const feed = await fetchFeed(url);
  const rows = feed.items.map((i) => ({
    feed_id: feedId,
    guid: i.guid,
    title: i.title,
    link: i.link,
    summary: i.summary,
    published_at: i.publishedAt,
  }));
  let added = 0;
  if (rows.length > 0) {
    // Existing items are left alone so read and saved state is never overwritten.
    const { data, error } = await db
      .from("news_items")
      .upsert(rows, { onConflict: "user_id,feed_id,guid", ignoreDuplicates: true })
      .select("id");
    if (error) throw new FeedError("Could not store the items.");
    added = data?.length ?? 0;
  }
  await db
    .from("news_feeds")
    .update({
      last_fetched_at: new Date().toISOString(),
      last_error: null,
      ...(feed.title ? { title: feed.title } : {}),
    })
    .eq("id", feedId);
  return added;
}

export async function addFeed(formData: FormData) {
  const parsed = feedSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const f = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("news_feeds")
    .insert({ url: f.url, topic: f.topic ?? null })
    .select("id")
    .single();
  if (error?.code === "23505") flash(PATH, "error", "You already follow that feed.");
  if (error || !data) flash(PATH, "error", "Could not save the feed");
  let added = 0;
  try {
    added = await refresh(supabase, data.id, f.url);
  } catch (e) {
    const msg = e instanceof FeedError ? e.message : "The feed could not be read.";
    await supabase.from("news_feeds").update({ last_error: msg }).eq("id", data.id);
    revalidatePath(PATH);
    flash(PATH, "error", `Feed saved, but the first fetch failed: ${msg}`);
  }
  revalidatePath(PATH);
  flash(PATH, "message", `Feed added with ${added} item${added === 1 ? "" : "s"}`);
}

export async function refreshAll() {
  const supabase = await createClient();
  const { data: feeds } = await supabase
    .from("news_feeds")
    .select("id, url")
    .is("deleted_at", null)
    .limit(30);
  // In parallel so many feeds fit inside one request; each fetch has its own 8 second limit.
  const results = await Promise.all(
    (feeds ?? []).map(async (f) => {
      try {
        return await refresh(supabase, f.id, f.url);
      } catch (e) {
        const msg = e instanceof FeedError ? e.message : "The feed could not be read.";
        await supabase.from("news_feeds").update({ last_error: msg }).eq("id", f.id);
        return null;
      }
    }),
  );
  const failed = results.filter((r) => r === null).length;
  const added = results.reduce<number>((n, r) => n + (r ?? 0), 0);
  revalidatePath(PATH);
  flash(
    PATH,
    failed ? "error" : "message",
    `${added} new item${added === 1 ? "" : "s"}${failed ? `; ${failed} feed${failed === 1 ? "" : "s"} failed (see the list)` : ""}`,
  );
}

export async function setItemState(formData: FormData) {
  const parsed = newsItemStateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const patch: { read_at?: string | null; saved?: boolean } = {};
  if (parsed.data.read) patch.read_at = parsed.data.read === "1" ? new Date().toISOString() : null;
  if (parsed.data.saved) patch.saved = parsed.data.saved === "1";
  if (Object.keys(patch).length === 0) flash(PATH, "error", "Nothing to change");
  const supabase = await createClient();
  const { error } = await supabase.from("news_items").update(patch).eq("id", parsed.data.id);
  if (error) flash(PATH, "error", "Could not update the item");
  revalidatePath(PATH);
  flash(PATH, "message", "Updated");
}

export async function removeFeed(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const revision = Number(formData.get("revision"));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("news_feeds")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("revision", revision)
    .select("id");
  if (error) flash(PATH, "error", "Could not remove the feed");
  if (!data || data.length === 0) flash(PATH, "error", STALE);
  revalidatePath(PATH);
  flash(PATH, "message", "Feed removed (its items are hidden)");
}
