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
import {
  cleanNote,
  cleanTitle,
  filterIdeas,
  IDEA_STATUSES,
  PRIORITY_LABELS,
  priorityText,
  sortIdeas,
  statusCounts,
  statusText,
  type IdeaRow,
  type IdeaStatus,
} from "./ideas";
import { ScreenHeader } from "./ScreenHeader";
import { supabase } from "./supabase";
import { C } from "./theme";

/** Native idea backlog: capture an idea in seconds (title, priority, optional note), filter by status, search, and move an idea to another status. Editing details, categories and deleting stay on the website. */
export function IdeasScreen({ onBack, onOpenWeb }: { onBack: () => void; onOpenWeb: () => void }) {
  const [ideas, setIdeas] = useState<IdeaRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [filter, setFilter] = useState<IdeaStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [priority, setPriority] = useState(3);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    const r = await supabase
      .from("idea_backlog")
      .select("id, title, description, category, priority, status, revision, created_at")
      .is("deleted_at", null)
      .order("priority")
      .order("created_at", { ascending: false })
      .limit(200)
      .overrideTypes<IdeaRow[]>();
    if (r.error) return setFailed(true);
    setIdeas(sortIdeas(r.data ?? []));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => statusCounts(ideas ?? []), [ideas]);
  const shown = useMemo(() => filterIdeas(ideas ?? [], filter, query), [ideas, filter, query]);

  async function capture() {
    const t = cleanTitle(title);
    if (!t) return setProblem("Enter a title for the idea.");
    if (working) return;
    setWorking("add");
    setProblem(null);
    const { data: ws } = await supabase
      .from("workspaces")
      .select("id")
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (!ws) {
      setWorking(null);
      return setProblem("Could not find your workspace.");
    }
    const { error } = await supabase
      .from("idea_backlog")
      .insert({ workspace_id: ws.id, title: t, description: cleanNote(note), priority });
    setWorking(null);
    if (error) return setProblem("Could not save the idea. Try again.");
    setTitle("");
    setNote("");
    setPriority(3);
    setAdding(false);
    load();
  }

  async function move(idea: IdeaRow, status: IdeaStatus) {
    if (working || status === idea.status) return;
    setWorking(idea.id);
    setProblem(null);
    const { data, error } = await supabase
      .from("idea_backlog")
      .update({ status })
      .eq("id", idea.id)
      .eq("revision", idea.revision)
      .select("id");
    setWorking(null);
    if (error) return setProblem("Could not update the idea.");
    if (!data || data.length === 0)
      setProblem("This idea was changed elsewhere. It has been refreshed; try again.");
    load();
  }

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Ideas" onBack={onBack} action={{ label: "More", onPress: onOpenWeb }} />
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
              placeholder="What is the idea?"
              placeholderTextColor={C.muted}
              value={title}
              onChangeText={setTitle}
              autoFocus
            />
            <TextInput
              style={[s.input, { minHeight: 70, textAlignVertical: "top" }]}
              placeholder="Notes (optional)"
              placeholderTextColor={C.muted}
              value={note}
              onChangeText={setNote}
              multiline
            />
            <View style={s.row}>
              {Object.entries(PRIORITY_LABELS).map(([v, label]) => (
                <Pressable
                  key={v}
                  onPress={() => setPriority(Number(v))}
                  style={[s.chip, priority === Number(v) && s.chipOn]}
                >
                  <Text style={[s.chipText, priority === Number(v) && s.chipTextOn]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={s.row}>
              <Pressable
                style={[s.btn, working === "add" && { opacity: 0.5 }]}
                disabled={working === "add"}
                onPress={capture}
              >
                <Text style={s.btnText}>Capture</Text>
              </Pressable>
              <Pressable style={s.ghost} onPress={() => setAdding(false)}>
                <Text style={s.ghostText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={s.addBtn} onPress={() => setAdding(true)}>
            <Text style={s.btnText}>+ Capture an idea</Text>
          </Pressable>
        )}

        {ideas && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.chips}
          >
            <Chip
              label={`All ${ideas.length}`}
              active={filter === "all"}
              onPress={() => setFilter("all")}
            />
            {counts.map((c) => (
              <Chip
                key={c.status}
                label={`${statusText(c.status)} ${c.count}`}
                active={filter === c.status}
                onPress={() => setFilter(c.status)}
              />
            ))}
          </ScrollView>
        )}
        <TextInput
          style={s.input}
          placeholder="Search ideas"
          placeholderTextColor={C.muted}
          value={query}
          onChangeText={setQuery}
        />

        {problem && <Text style={s.error}>{problem}</Text>}
        {failed && <Text style={s.error}>Could not load ideas. Pull down to retry.</Text>}
        {ideas === null && !failed && (
          <ActivityIndicator color={C.primary} style={{ marginTop: 24 }} />
        )}
        {ideas && shown.length === 0 && (
          <Text style={s.muted}>
            {ideas.length === 0 ? "No ideas yet. Capture the first one above." : "Nothing matches."}
          </Text>
        )}

        {shown.map((i) => (
          <Pressable key={i.id} style={s.card} onPress={() => setOpen(open === i.id ? null : i.id)}>
            <View style={s.top}>
              <Text style={s.title} numberOfLines={open === i.id ? undefined : 2}>
                {i.title}
              </Text>
              <Text style={[s.badge, i.priority <= 2 && { color: C.danger }]}>
                {priorityText(i.priority)}
              </Text>
            </View>
            <Text style={s.meta}>
              {[statusText(i.status), i.category].filter(Boolean).join(" · ")}
            </Text>
            {open === i.id && (
              <View>
                {!!i.description && <Text style={s.desc}>{i.description}</Text>}
                <View style={s.moves}>
                  {IDEA_STATUSES.filter((st) => st !== i.status).map((st) => (
                    <Pressable
                      key={st}
                      style={[s.ghost, working === i.id && { opacity: 0.5 }]}
                      disabled={working === i.id}
                      onPress={() => move(i, st)}
                    >
                      <Text style={s.ghostText}>{statusText(st)}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active && s.chipOn]}>
      <Text style={[s.chipText, active && s.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  page: { padding: 16, paddingBottom: 32 },
  chips: { gap: 8, paddingBottom: 12 },
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
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 10 },
  error: { color: C.danger, marginBottom: 8 },
  muted: { color: C.muted, marginTop: 12 },
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
  badge: { color: C.muted, fontSize: 12, fontWeight: "700" },
  meta: { color: C.muted, fontSize: 12, marginTop: 4 },
  desc: { color: C.text, marginTop: 10, lineHeight: 20 },
  moves: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
});
