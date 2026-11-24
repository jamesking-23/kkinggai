import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  feedName,
  filterItems,
  plainSummary,
  safeLink,
  shortDate,
  unreadByFeed,
  type FeedRow,
  type NewsFilter,
  type NewsItem,
} from "./news";
import { ScreenHeader } from "./ScreenHeader";
import { supabase } from "./supabase";
import { C } from "./theme";

/** Native news reader: stored items from your feeds, filter by unread, saved or feed, open an article, mark read and save. Adding feeds and fetching new items stay on the website. */
export function NewsScreen({ onBack, onOpenWeb }: { onBack: () => void; onOpenWeb: () => void }) {
  const [feeds, setFeeds] = useState<FeedRow[] | null>(null);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [failed, setFailed] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<NewsFilter>("unread");
  const [feedId, setFeedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    const [f, i] = await Promise.all([
      supabase
        .from("news_feeds")
        .select("id, title, url, last_error")
        .is("deleted_at", null)
        .order("created_at")
        .overrideTypes<FeedRow[], { merge: false }>(),
      supabase
        .from("news_items")
        .select("id, feed_id, title, link, summary, published_at, read_at, saved")
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(200)
        .overrideTypes<NewsItem[], { merge: false }>(),
    ]);
    if (f.error || i.error) return setFailed(true);
    setFeeds(f.data ?? []);
    setItems(i.data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const names = useMemo(() => new Map((feeds ?? []).map((f) => [f.id, feedName(f)])), [feeds]);
  const unread = useMemo(() => unreadByFeed(items), [items]);
  const shown = useMemo(() => filterItems(items, filter, feedId), [items, filter, feedId]);

  async function patch(id: string, change: { read_at?: string | null; saved?: boolean }) {
    setProblem(null);
    const before = items;
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...change } : x)));
    const { error } = await supabase.from("news_items").update(change).eq("id", id);
    if (error) {
      setItems(before);
      setProblem("Could not update the item. Try again.");
    }
  }

  async function openItem(i: NewsItem) {
    const url = safeLink(i.link);
    if (!url) return setProblem("This item has no web link.");
    if (!i.read_at) patch(i.id, { read_at: new Date().toISOString() });
    try {
      await Linking.openURL(url);
    } catch {
      setProblem("Could not open the link.");
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="News" onBack={onBack} action={{ label: "More", onPress: onOpenWeb }} />
      <ScrollView
        contentContainerStyle={s.page}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        <View style={s.row}>
          {(["unread", "saved", "all"] as const).map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={[s.chip, filter === f && s.chipOn]}
            >
              <Text style={[s.chipText, filter === f && s.chipTextOn]}>
                {f === "unread" ? "Unread" : f === "saved" ? "Saved" : "All"}
              </Text>
            </Pressable>
          ))}
        </View>
        {feeds && feeds.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.chips}
          >
            <Pressable onPress={() => setFeedId(null)} style={[s.chip, !feedId && s.chipOn]}>
              <Text style={[s.chipText, !feedId && s.chipTextOn]}>All feeds</Text>
            </Pressable>
            {feeds.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => setFeedId(feedId === f.id ? null : f.id)}
                style={[s.chip, feedId === f.id && s.chipOn]}
              >
                <Text style={[s.chipText, feedId === f.id && s.chipTextOn]}>
                  {feedName(f)}
                  {unread.get(f.id) ? ` ${unread.get(f.id)}` : ""}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {problem && <Text style={s.error}>{problem}</Text>}
        {failed && <Text style={s.error}>Could not load news. Pull down to retry.</Text>}
        {feeds === null && !failed && <ActivityIndicator color={C.primary} />}
        {feeds && feeds.length === 0 && (
          <Text style={s.muted}>No feeds yet. Add feeds on the website (More).</Text>
        )}
        {feeds && feeds.length > 0 && shown.length === 0 && (
          <Text style={s.muted}>
            {filter === "unread"
              ? "Nothing unread."
              : filter === "saved"
                ? "Nothing saved."
                : "No items yet."}{" "}
            New items are fetched from the website (More).
          </Text>
        )}

        {shown.map((i) => (
          <View key={i.id} style={s.card}>
            <Pressable onPress={() => openItem(i)}>
              <Text style={[s.title, i.read_at && { color: C.muted, fontWeight: "500" }]}>
                {i.title}
              </Text>
              <Text style={s.meta}>
                {[names.get(i.feed_id), shortDate(i.published_at)].filter(Boolean).join(" · ")}
              </Text>
              {!!plainSummary(i.summary) && <Text style={s.body}>{plainSummary(i.summary)}</Text>}
            </Pressable>
            <View style={s.actions}>
              <Pressable style={s.ghost} onPress={() => patch(i.id, { saved: !i.saved })}>
                <Text style={s.ghostText}>{i.saved ? "Unsave" : "Save"}</Text>
              </Pressable>
              <Pressable
                style={s.ghost}
                onPress={() =>
                  patch(i.id, { read_at: i.read_at ? null : new Date().toISOString() })
                }
              >
                <Text style={s.ghostText}>{i.read_at ? "Mark unread" : "Mark read"}</Text>
              </Pressable>
            </View>
          </View>
        ))}
        {items.length >= 200 && <Text style={s.muted}>Showing the 200 most recent items.</Text>}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  page: { padding: 16, paddingBottom: 32 },
  row: { flexDirection: "row", gap: 8, marginBottom: 10 },
  chips: { gap: 8, paddingBottom: 10 },
  chip: {
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipOn: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { color: C.text, fontSize: 13 },
  chipTextOn: { color: "#fff", fontWeight: "700" },
  ghost: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ghostText: { color: C.primary, fontWeight: "600", fontSize: 13 },
  error: { color: C.danger, marginBottom: 8 },
  muted: { color: C.muted, marginTop: 8 },
  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  title: { color: C.text, fontWeight: "700", fontSize: 15, lineHeight: 21 },
  meta: { color: C.muted, fontSize: 12, marginTop: 4 },
  body: { color: C.text, marginTop: 8, lineHeight: 20 },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
});
