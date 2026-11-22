import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { dueLabel } from "./format";
import { filterModules, greeting, type ModuleLink } from "./modules";
import { supabase } from "./supabase";
import { C } from "./theme";

type Next = { id: string; title: string; due_at: string | null };

/** Native home: live counts, what is due next, and every module. Modules open in the Website tab until they get native screens. */
export function Dashboard({
  onOpen,
  onTab,
}: {
  onOpen: (path: string) => void;
  onTab: (tab: "tasks" | "notifications") => void;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [unread, setUnread] = useState<number | null>(null);
  const [next, setNext] = useState<Next[]>([]);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setFailed(false);
    const [t, n, list] = await Promise.all([
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .in("status", ["todo", "in_progress"]),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null),
      supabase
        .from("tasks")
        .select("id, title, due_at")
        .is("deleted_at", null)
        .in("status", ["todo", "in_progress"])
        .not("due_at", "is", null)
        .order("due_at", { ascending: true })
        .limit(3)
        .overrideTypes<Next[]>(),
    ]);
    if (t.error || n.error || list.error) return setFailed(true);
    setOpen(t.count ?? 0);
    setUnread(n.count ?? 0);
    setNext(list.data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const modules: ModuleLink[] = filterModules(query);

  return (
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
      <Text style={s.hello}>{greeting(new Date().getHours())}</Text>
      <Text style={s.sub}>Here is where things stand.</Text>
      {failed && <Text style={s.error}>Could not load your summary. Pull down to retry.</Text>}

      <View style={s.tiles}>
        <Pressable style={s.tile} onPress={() => onTab("tasks")}>
          <Text style={s.tileNum}>{open ?? "–"}</Text>
          <Text style={s.tileLabel}>Open tasks</Text>
        </Pressable>
        <Pressable style={s.tile} onPress={() => onTab("notifications")}>
          <Text style={s.tileNum}>{unread ?? "–"}</Text>
          <Text style={s.tileLabel}>Unread</Text>
        </Pressable>
      </View>

      {next.length > 0 && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Due next</Text>
          {next.map((t) => (
            <View key={t.id} style={s.row}>
              <Text style={s.rowTitle} numberOfLines={1}>
                {t.title}
              </Text>
              <Text style={s.rowDue}>{dueLabel(t.due_at)}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={s.section}>Modules</Text>
      <TextInput
        style={s.search}
        placeholder="Find a module"
        placeholderTextColor={C.muted}
        value={query}
        onChangeText={setQuery}
      />
      <View style={s.grid}>
        {modules.map((m) => (
          <Pressable key={m.id} style={s.module} onPress={() => onOpen(m.path)}>
            <Text style={s.moduleName}>{m.label}</Text>
            <Text style={s.moduleHint} numberOfLines={1}>
              {m.hint}
            </Text>
          </Pressable>
        ))}
      </View>
      {modules.length === 0 && <Text style={s.sub}>No module matches “{query}”.</Text>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { padding: 16, paddingBottom: 32 },
  hello: { fontSize: 28, fontWeight: "800", color: C.text },
  sub: { color: C.muted, fontSize: 14, marginTop: 2, marginBottom: 16 },
  error: { color: C.danger, marginBottom: 12 },
  tiles: { flexDirection: "row", gap: 12, marginBottom: 12 },
  tile: {
    flex: 1,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 16,
  },
  tileNum: { fontSize: 32, fontWeight: "800", color: C.primary },
  tileLabel: { color: C.muted, fontSize: 13, marginTop: 2 },
  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
  },
  cardTitle: { fontWeight: "700", color: C.text, marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, gap: 12 },
  rowTitle: { flex: 1, color: C.text },
  rowDue: { color: C.muted, fontSize: 12 },
  section: { fontSize: 18, fontWeight: "700", color: C.text, marginTop: 16, marginBottom: 8 },
  search: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    color: C.text,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  module: {
    width: "48%",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 14,
  },
  moduleName: { fontWeight: "700", color: C.text },
  moduleHint: { color: C.muted, fontSize: 12, marginTop: 2 },
});
