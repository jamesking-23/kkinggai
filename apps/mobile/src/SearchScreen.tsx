import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  cleanQuery,
  groupHits,
  highlight,
  intersectHits,
  splitTerms,
  type SearchGroup,
  type SearchHit,
} from "./search";
import { ScreenHeader } from "./ScreenHeader";
import { supabase } from "./supabase";
import { C } from "./theme";

/** Native search across the workspace, your vault and chats, using the same server function as the website. Several words must all match; put a phrase in "quotes". Tapping a result opens it. */
export function SearchScreen({
  onBack,
  onOpenPath,
}: {
  onBack: () => void;
  onOpenPath: (path: string) => void;
}) {
  const [text, setText] = useState("");
  const [groups, setGroups] = useState<SearchGroup[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ws, setWs] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<ReadonlySet<string> | null>(null);
  const [ready, setReady] = useState(false);
  const run = useRef(0);

  useEffect(() => {
    (async () => {
      const w = await supabase
        .from("workspaces")
        .select("id")
        .order("created_at")
        .limit(1)
        .maybeSingle();
      const id = w.data?.id ?? null;
      setWs(id);
      if (id) {
        const m = await supabase
          .from("workspace_modules")
          .select("module_id")
          .eq("workspace_id", id)
          .eq("enabled", true);
        setEnabled(new Set((m.data ?? []).map((x) => x.module_id as string)));
      }
      setReady(true);
    })();
  }, []);

  const q = cleanQuery(text);
  const terms = useMemo(() => (q ? splitTerms(q) : []), [q]);

  useEffect(() => {
    if (!q || !ws || !enabled) {
      setGroups(null);
      setFailed(false);
      return;
    }
    const mine = ++run.current;
    setSearching(true);
    const t = setTimeout(async () => {
      const many = terms.length > 1;
      const lists = await Promise.all(
        (many ? terms : [q]).map((term) =>
          supabase.rpc("search_workspace", { ws, q: term, per_kind: many ? 20 : 8 }),
        ),
      );
      if (mine !== run.current) return;
      setSearching(false);
      if (lists.some((l) => l.error)) {
        setFailed(true);
        return setGroups(null);
      }
      setFailed(false);
      const hits = intersectHits(lists.map((l) => (l.data ?? []) as SearchHit[]));
      setGroups(groupHits(hits, enabled));
    }, 350);
    return () => clearTimeout(t);
  }, [q, ws, enabled, terms]);

  const marks = terms.length ? terms : q ? [q] : [];
  const Marked = ({ value, style }: { value: string; style: object }) => (
    <Text style={style}>
      {highlight(value, marks).map((p, i) => (
        <Text key={i} style={p.match ? s.mark : undefined}>
          {p.text}
        </Text>
      ))}
    </Text>
  );

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Search" onBack={onBack} />
      <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
        <TextInput
          style={s.input}
          placeholder="Search tasks, goals, notes…"
          placeholderTextColor={C.muted}
          value={text}
          onChangeText={setText}
          autoFocus
          autoCapitalize="none"
          returnKeyType="search"
          maxLength={100}
        />
        <Text style={s.hint}>
          Several words must all match; put a phrase in "quotes". Searches this workspace, your
          private vault and chats; only enabled modules are included.
        </Text>
        {!ready && <ActivityIndicator color={C.primary} />}
        {ready && !ws && <Text style={s.error}>Could not find your workspace.</Text>}
        {ready && ws && !q && <Text style={s.muted}>Type at least 2 characters.</Text>}
        {searching && <ActivityIndicator color={C.primary} style={{ marginTop: 12 }} />}
        {failed && <Text style={s.error}>Search failed. Try again.</Text>}
        {!searching && q && groups && groups.length === 0 && (
          <Text style={s.muted}>No results for “{q}”.</Text>
        )}
        {!searching &&
          groups?.map((g) => (
            <View key={g.kind} style={s.card}>
              <Text style={s.group}>{g.label}</Text>
              {g.hits.map((hit) => (
                <Pressable
                  key={`${hit.kind}:${hit.id}`}
                  style={s.hit}
                  onPress={() => onOpenPath(hit.href)}
                >
                  <Marked value={hit.title} style={s.title} />
                  {!!hit.snippet && <Marked value={hit.snippet} style={s.snippet} />}
                </Pressable>
              ))}
            </View>
          ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  page: { padding: 16, paddingBottom: 32 },
  input: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    color: C.text,
  },
  hint: { color: C.muted, fontSize: 12, marginBottom: 12 },
  error: { color: C.danger, marginTop: 8 },
  muted: { color: C.muted, marginTop: 8 },
  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  group: {
    color: C.muted,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  hit: { paddingVertical: 8 },
  title: { color: C.primary, fontWeight: "600", fontSize: 15 },
  snippet: { color: C.muted, fontSize: 12, marginTop: 2 },
  mark: { backgroundColor: "rgba(79,124,255,0.3)", color: C.text },
});
