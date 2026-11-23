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
  checkDate,
  checkJournal,
  DATE_KINDS,
  daysAwayText,
  moodText,
  MOODS,
  upcoming,
  type DateKind,
  type DateRow,
  type JournalRow,
} from "./personal";
import { ScreenHeader } from "./ScreenHeader";
import { supabase } from "./supabase";
import { C } from "./theme";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Native Personal: a private journal (one entry per day, with mood and tags) and important dates with a countdown. Deleting and old entries stay on the website. */
export function PersonalScreen({
  onBack,
  onOpenWeb,
}: {
  onBack: () => void;
  onOpenWeb: () => void;
}) {
  const [tab, setTab] = useState<"journal" | "dates">("journal");
  const [entries, setEntries] = useState<JournalRow[] | null>(null);
  const [dates, setDates] = useState<DateRow[] | null>(null);
  const [zone, setZone] = useState("UTC");
  const [failed, setFailed] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [mood, setMood] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<DateKind>("birthday");
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [year, setYear] = useState("");

  const load = useCallback(async () => {
    setFailed(false);
    const [st, j, d] = await Promise.all([
      supabase.from("user_settings").select("timezone").maybeSingle(),
      supabase
        .from("journal_entries")
        .select("id, entry_date, mood, body, tags")
        .is("deleted_at", null)
        .order("entry_date", { ascending: false })
        .limit(30)
        .overrideTypes<JournalRow[], { merge: false }>(),
      supabase
        .from("important_dates")
        .select("id, title, kind, month, day, year, notes, revision")
        .is("deleted_at", null)
        .overrideTypes<DateRow[]>(),
    ]);
    setZone(safeZone(st.data?.timezone));
    if (j.error || d.error) return setFailed(true);
    setEntries(j.data ?? []);
    setDates(d.data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const today = localDate(new Date().toISOString(), zone);
  const soon = useMemo(() => upcoming(dates ?? [], today), [dates, today]);
  const todayEntry = entries?.find((e) => e.entry_date === today);

  async function saveEntry() {
    const v = checkJournal(body, tags);
    if (typeof v === "string") return setProblem(v);
    if (saving) return;
    setSaving(true);
    setProblem(null);
    const { error } = await supabase
      .from("journal_entries")
      .insert({ entry_date: today, mood, body: v.body, tags: v.tags });
    setSaving(false);
    if (error?.code === "23505")
      return setProblem(
        "There is already an entry for today. Remove it on the website to rewrite it.",
      );
    if (error) return setProblem("Could not save the entry. Try again.");
    setBody("");
    setTags("");
    setMood(null);
    setWriting(false);
    load();
  }

  async function saveDate() {
    const v = checkDate(title, month, day, year, "");
    if (typeof v === "string") return setProblem(v);
    if (saving) return;
    setSaving(true);
    setProblem(null);
    const { error } = await supabase.from("important_dates").insert({
      title: v.title,
      kind,
      month: v.month,
      day: v.day,
      year: v.year,
      notes: v.notes,
    });
    setSaving(false);
    if (error) return setProblem("Could not save the date. Try again.");
    setTitle("");
    setMonth("");
    setDay("");
    setYear("");
    setKind("birthday");
    setAdding(false);
    load();
  }

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader
        title="Personal"
        onBack={onBack}
        action={{ label: "More", onPress: onOpenWeb }}
      />
      <View style={s.tabs}>
        {(["journal", "dates"] as const).map((t) => (
          <Pressable
            key={t}
            style={[s.tab, tab === t && s.tabOn]}
            onPress={() => {
              setTab(t);
              setProblem(null);
            }}
          >
            <Text style={[s.tabText, tab === t && s.tabTextOn]}>
              {t === "journal" ? "Journal" : "Important dates"}
            </Text>
          </Pressable>
        ))}
      </View>
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
        {failed && <Text style={s.error}>Could not load. Pull down to retry.</Text>}
        {entries === null && !failed && <ActivityIndicator color={C.primary} />}
        {problem && <Text style={s.error}>{problem}</Text>}

        {tab === "journal" && entries && (
          <>
            {writing ? (
              <View style={s.card}>
                <Text style={s.meta}>Entry for {today}</Text>
                <TextInput
                  style={[s.input, { minHeight: 140, textAlignVertical: "top", marginTop: 8 }]}
                  placeholder="Write about your day"
                  placeholderTextColor={C.muted}
                  value={body}
                  onChangeText={setBody}
                  multiline
                  autoFocus
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.chips}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable
                      key={n}
                      onPress={() => setMood(mood === n ? null : n)}
                      style={[s.chip, mood === n && s.chipOn]}
                    >
                      <Text style={[s.chipText, mood === n && s.chipTextOn]}>{MOODS[n]}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <TextInput
                  style={s.input}
                  placeholder="Tags, comma separated"
                  placeholderTextColor={C.muted}
                  value={tags}
                  onChangeText={setTags}
                  autoCapitalize="none"
                />
                <View style={s.row}>
                  <Pressable
                    style={[s.btn, saving && { opacity: 0.5 }]}
                    disabled={saving}
                    onPress={saveEntry}
                  >
                    <Text style={s.btnText}>Save entry</Text>
                  </Pressable>
                  <Pressable style={s.ghost} onPress={() => setWriting(false)}>
                    <Text style={s.ghostText}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            ) : todayEntry ? (
              <Text style={s.muted}>You have written today's entry.</Text>
            ) : (
              <Pressable style={s.addBtn} onPress={() => setWriting(true)}>
                <Text style={s.btnText}>+ Write today's entry</Text>
              </Pressable>
            )}
            {entries.length === 0 && <Text style={s.muted}>No entries yet.</Text>}
            {entries.map((e) => (
              <Pressable
                key={e.id}
                style={s.card}
                onPress={() => setOpen(open === e.id ? null : e.id)}
              >
                <Text style={s.title}>{e.entry_date}</Text>
                <Text style={s.meta}>
                  {[moodText(e.mood), ...e.tags.map((t) => `#${t}`)].filter(Boolean).join(" · ") ||
                    "No mood or tags"}
                </Text>
                <Text style={s.body} numberOfLines={open === e.id ? undefined : 3}>
                  {e.body}
                </Text>
              </Pressable>
            ))}
            {entries.length >= 30 && (
              <Text style={s.muted}>Showing the 30 most recent entries.</Text>
            )}
          </>
        )}

        {tab === "dates" && dates && (
          <>
            {adding ? (
              <View style={s.card}>
                <TextInput
                  style={s.input}
                  placeholder="Title, e.g. Mum's birthday"
                  placeholderTextColor={C.muted}
                  value={title}
                  onChangeText={setTitle}
                  autoFocus
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.chips}
                >
                  {DATE_KINDS.map((k) => (
                    <Pressable
                      key={k}
                      onPress={() => setKind(k)}
                      style={[s.chip, kind === k && s.chipOn]}
                    >
                      <Text style={[s.chipText, kind === k && s.chipTextOn]}>
                        {k.charAt(0).toUpperCase() + k.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <View style={s.row}>
                  {(
                    [
                      ["Month 1-12", month, setMonth],
                      ["Day", day, setDay],
                      ["Year (opt.)", year, setYear],
                    ] as const
                  ).map(([ph, v, set]) => (
                    <TextInput
                      key={ph}
                      style={[s.input, { flex: 1, marginBottom: 0 }]}
                      placeholder={ph}
                      placeholderTextColor={C.muted}
                      value={v}
                      onChangeText={set}
                      keyboardType="number-pad"
                    />
                  ))}
                </View>
                <View style={[s.row, { marginTop: 10 }]}>
                  <Pressable
                    style={[s.btn, saving && { opacity: 0.5 }]}
                    disabled={saving}
                    onPress={saveDate}
                  >
                    <Text style={s.btnText}>Add date</Text>
                  </Pressable>
                  <Pressable style={s.ghost} onPress={() => setAdding(false)}>
                    <Text style={s.ghostText}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable style={s.addBtn} onPress={() => setAdding(true)}>
                <Text style={s.btnText}>+ Add an important date</Text>
              </Pressable>
            )}
            {soon.length === 0 && <Text style={s.muted}>No important dates yet.</Text>}
            {soon.map((d) => (
              <View key={d.id} style={s.card}>
                <View style={s.top}>
                  <Text style={s.title}>{d.title}</Text>
                  <Text style={s.badge}>{daysAwayText(d.daysAway)}</Text>
                </View>
                <Text style={s.meta}>
                  {[
                    `${d.day} ${MONTHS[d.month - 1]}${d.year ? ` ${d.year}` : ""}`,
                    d.kind,
                    d.turning !== null && d.turning > 0
                      ? d.kind === "birthday"
                        ? `turning ${d.turning}`
                        : `year ${d.turning}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  tabs: { flexDirection: "row", paddingHorizontal: 16, gap: 8, paddingTop: 8 },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  tabOn: { backgroundColor: C.primary, borderColor: C.primary },
  tabText: { color: C.text, fontWeight: "600" },
  tabTextOn: { color: "#fff" },
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
  row: { flexDirection: "row", gap: 8 },
  error: { color: C.danger, marginBottom: 8 },
  muted: { color: C.muted, marginBottom: 12 },
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
  badge: { color: C.primary, fontSize: 12, fontWeight: "700" },
  meta: { color: C.muted, fontSize: 12, marginTop: 4 },
  body: { color: C.text, marginTop: 8, lineHeight: 20 },
});
