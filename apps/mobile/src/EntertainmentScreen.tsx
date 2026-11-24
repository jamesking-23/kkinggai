import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { localDate, safeZone } from "./agenda";
import {
  checkMedia,
  filterMedia,
  kindLabel,
  MEDIA_KINDS,
  MEDIA_STATUSES,
  stars,
  statusCounts,
  statusLabel,
  statusPatch,
  type MediaKind,
  type MediaRow,
  type MediaStatus,
} from "./media";
import { ScreenHeader } from "./ScreenHeader";
import { supabase } from "./supabase";
import { C } from "./theme";

/** Native entertainment log: books, films, shows, games, music and podcasts with status, rating and search. Dates, notes, tags and deleting stay on the website. */
export function EntertainmentScreen({
  onBack,
  onOpenWeb,
}: {
  onBack: () => void;
  onOpenWeb: () => void;
}) {
  const [items, setItems] = useState<MediaRow[] | null>(null);
  const [zone, setZone] = useState("UTC");
  const [failed, setFailed] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<MediaStatus | "all">("all");
  const [kind, setKind] = useState<MediaKind | "all">("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [creator, setCreator] = useState("");
  const [newKind, setNewKind] = useState<MediaKind>("book");
  const [newStatus, setNewStatus] = useState<MediaStatus>("wishlist");

  const load = useCallback(async () => {
    setFailed(false);
    const [st, r] = await Promise.all([
      supabase.from("user_settings").select("timezone").maybeSingle(),
      supabase
        .from("media_items")
        .select("id, kind, title, creator, status, rating, finished_on, notes, revision")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(500)
        .overrideTypes<MediaRow[], { merge: false }>(),
    ]);
    setZone(safeZone(st.data?.timezone));
    if (r.error) return setFailed(true);
    setItems(r.data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => statusCounts(items ?? []), [items]);
  const shown = useMemo(
    () => filterMedia(items ?? [], status, kind, query),
    [items, status, kind, query],
  );

  async function add() {
    const v = checkMedia(title, creator);
    if (typeof v === "string") return setProblem(v);
    if (working) return;
    setWorking("add");
    setProblem(null);
    const { error } = await supabase.from("media_items").insert({
      kind: newKind,
      title: v.title,
      creator: v.creator,
      status: newStatus,
      notes: "",
      tags: [],
    });
    setWorking(null);
    if (error) return setProblem("Could not save the item. Try again.");
    setTitle("");
    setCreator("");
    setNewKind("book");
    setNewStatus("wishlist");
    setAdding(false);
    load();
  }

  async function move(i: MediaRow, to: MediaStatus) {
    if (working || to === i.status) return;
    setWorking(i.id);
    setProblem(null);
    const today = localDate(new Date().toISOString(), zone);
    const { data, error } = await supabase
      .from("media_items")
      .update(statusPatch(i, to, to === "done" ? rating : null, today))
      .eq("id", i.id)
      .eq("revision", i.revision)
      .select("id");
    setWorking(null);
    if (error) return setProblem("Could not update the item.");
    if (!data || data.length === 0)
      setProblem("This item was changed elsewhere. It has been refreshed; try again.");
    setRating(null);
    load();
  }

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader
        title="Entertainment"
        onBack={onBack}
        action={{ label: "More", onPress: onOpenWeb }}
      />
      <ScrollView
        contentContainerStyle={s.page}
        keyboardShouldPersistTaps="handled"
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
        {adding ? (
          <View style={s.card}>
            <TextInput
              style={s.input}
              placeholder="Title"
              placeholderTextColor={C.muted}
              value={title}
              onChangeText={setTitle}
              autoFocus
            />
            <TextInput
              style={s.input}
              placeholder="Author, director or artist (optional)"
              placeholderTextColor={C.muted}
              value={creator}
              onChangeText={setCreator}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.chips}
            >
              {MEDIA_KINDS.map((k) => (
                <Chip
                  key={k}
                  label={kindLabel(k)}
                  on={newKind === k}
                  onPress={() => setNewKind(k)}
                />
              ))}
            </ScrollView>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.chips}
            >
              {MEDIA_STATUSES.map((st) => (
                <Chip
                  key={st}
                  label={statusLabel(st)}
                  on={newStatus === st}
                  onPress={() => setNewStatus(st)}
                />
              ))}
            </ScrollView>
            <View style={s.row}>
              <Pressable
                style={[s.btn, working === "add" && { opacity: 0.5 }]}
                disabled={working === "add"}
                onPress={add}
              >
                <Text style={s.btnText}>Add</Text>
              </Pressable>
              <Pressable style={s.ghost} onPress={() => setAdding(false)}>
                <Text style={s.ghostText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={s.addBtn} onPress={() => setAdding(true)}>
            <Text style={s.btnText}>+ Add an item</Text>
          </Pressable>
        )}

        {items && (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.chips}
            >
              <Chip
                label={`All ${items.length}`}
                on={status === "all"}
                onPress={() => setStatus("all")}
              />
              {counts.map((c) => (
                <Chip
                  key={c.status}
                  label={`${statusLabel(c.status)} ${c.count}`}
                  on={status === c.status}
                  onPress={() => setStatus(c.status)}
                />
              ))}
            </ScrollView>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.chips}
            >
              <Chip label="All kinds" on={kind === "all"} onPress={() => setKind("all")} />
              {MEDIA_KINDS.map((k) => (
                <Chip key={k} label={kindLabel(k)} on={kind === k} onPress={() => setKind(k)} />
              ))}
            </ScrollView>
          </>
        )}
        <TextInput
          style={s.input}
          placeholder="Search title or creator"
          placeholderTextColor={C.muted}
          value={query}
          onChangeText={setQuery}
        />

        {problem && <Text style={s.error}>{problem}</Text>}
        {failed && <Text style={s.error}>Could not load. Pull down to retry.</Text>}
        {items === null && !failed && <ActivityIndicator color={C.primary} />}
        {items && shown.length === 0 && (
          <Text style={s.muted}>
            {items.length === 0 ? "Nothing added yet." : "Nothing matches."}
          </Text>
        )}

        {shown.map((i) => (
          <Pressable
            key={i.id}
            style={s.card}
            onPress={() => {
              setOpen(open === i.id ? null : i.id);
              setRating(null);
            }}
          >
            <View style={s.top}>
              <Text style={s.title}>{i.title}</Text>
              <Text style={s.badge}>{stars(i.rating)}</Text>
            </View>
            <Text style={s.meta}>
              {[
                kindLabel(i.kind),
                i.creator,
                statusLabel(i.status),
                i.finished_on ? `finished ${i.finished_on}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
            {open === i.id && (
              <View>
                {!!i.notes && <Text style={s.desc}>{i.notes}</Text>}
                <Text style={[s.meta, { marginTop: 10 }]}>Rating when marking done (optional)</Text>
                <View style={s.row}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Chip
                      key={n}
                      label={`${n}★`}
                      on={rating === n}
                      onPress={() => setRating(rating === n ? null : n)}
                    />
                  ))}
                </View>
                <View style={s.moves}>
                  {MEDIA_STATUSES.filter((st) => st !== i.status).map((st) => (
                    <Pressable
                      key={st}
                      style={[s.ghost, working === i.id && { opacity: 0.5 }]}
                      disabled={working === i.id}
                      onPress={() => move(i, st)}
                    >
                      <Text style={s.ghostText}>{statusLabel(st)}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </Pressable>
        ))}
        {items && items.length >= 500 && (
          <Text style={s.muted}>Showing the 500 most recent items.</Text>
        )}
      </ScrollView>
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, on && s.chipOn]}>
      <Text style={[s.chipText, on && s.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  page: { padding: 16, paddingBottom: 32 },
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
  input: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    color: C.text,
  },
  addBtn: {
    backgroundColor: C.primary,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  btn: { backgroundColor: C.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  btnText: { color: "#fff", fontWeight: "700" },
  ghost: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ghostText: { color: C.primary, fontWeight: "600", fontSize: 13 },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 6 },
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
  top: { flexDirection: "row", gap: 8, justifyContent: "space-between" },
  title: { flex: 1, color: C.text, fontWeight: "700", fontSize: 15 },
  badge: { color: C.primary, fontSize: 12 },
  meta: { color: C.muted, fontSize: 12, marginTop: 4 },
  desc: { color: C.text, marginTop: 10, lineHeight: 20 },
  moves: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
});
