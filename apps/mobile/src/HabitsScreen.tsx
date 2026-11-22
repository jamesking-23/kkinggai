import { useCallback, useEffect, useState } from "react";
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
import { addDays, cleanHabitName, viewHabit, type HabitRow, type HabitView } from "./habits";
import { ScreenHeader } from "./ScreenHeader";
import { supabase } from "./supabase";
import { C } from "./theme";

type Log = { habit_id: string; log_date: string };

/** Native habits: tick today on or off, see streaks and this week's progress, add a daily habit. Weekly targets and archiving are on the website. */
export function HabitsScreen({ onBack, onOpenWeb }: { onBack: () => void; onOpenWeb: () => void }) {
  const [habits, setHabits] = useState<HabitView[] | null>(null);
  const [today, setToday] = useState("");
  const [failed, setFailed] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    const settings = await supabase.from("user_settings").select("timezone").maybeSingle();
    const day = localDate(new Date().toISOString(), safeZone(settings.data?.timezone));
    const [h, l] = await Promise.all([
      supabase
        .from("habits")
        .select("id, workspace_id, name, cadence, target_per_period")
        .is("archived_at", null)
        .order("created_at")
        .overrideTypes<HabitRow[]>(),
      supabase
        .from("habit_logs")
        .select("habit_id, log_date")
        .gte("log_date", addDays(day, -60))
        .overrideTypes<Log[]>(),
    ]);
    if (h.error || l.error) return setFailed(true);
    const by = new Map<string, string[]>();
    for (const x of l.data ?? []) by.set(x.habit_id, [...(by.get(x.habit_id) ?? []), x.log_date]);
    setToday(day);
    setHabits((h.data ?? []).map((row) => viewHabit(row, by.get(row.id) ?? [], day)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(h: HabitView) {
    if (working) return;
    setWorking(h.id);
    setProblem(null);
    const res = h.doneToday
      ? await supabase.from("habit_logs").delete().eq("habit_id", h.id).eq("log_date", today)
      : await supabase
          .from("habit_logs")
          .insert({ workspace_id: h.workspace_id, habit_id: h.id, log_date: today });
    setWorking(null);
    // 23505 = already logged today (for example from the website): treat as done.
    if (res.error && res.error.code !== "23505")
      return setProblem("Could not save. Check your connection.");
    load();
  }

  async function add() {
    const clean = cleanHabitName(name);
    if (!clean || working) return;
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
    const { error } = await supabase.from("habits").insert({ workspace_id: ws.id, name: clean });
    setWorking(null);
    if (error) return setProblem("Could not add the habit. Try again.");
    setName("");
    load();
  }

  const done = habits?.filter((h) => h.doneToday).length ?? 0;
  const best = Math.max(0, ...(habits ?? []).map((h) => h.streak));

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Habits" onBack={onBack} action={{ label: "More", onPress: onOpenWeb }} />
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
        {habits && (
          <View style={s.tiles}>
            <View style={s.tile}>
              <Text style={s.num}>
                {done}/{habits.length}
              </Text>
              <Text style={s.tileLabel}>Done today</Text>
            </View>
            <View style={s.tile}>
              <Text style={s.num}>{best}</Text>
              <Text style={s.tileLabel}>Best daily streak</Text>
            </View>
          </View>
        )}
        <View style={s.addRow}>
          <TextInput
            style={s.input}
            placeholder="Add a daily habit"
            placeholderTextColor={C.muted}
            value={name}
            onChangeText={setName}
            onSubmitEditing={add}
            returnKeyType="done"
          />
          <Pressable
            style={[s.add, (!cleanHabitName(name) || working === "add") && { opacity: 0.5 }]}
            disabled={!cleanHabitName(name) || working === "add"}
            onPress={add}
          >
            <Text style={s.addText}>Add</Text>
          </Pressable>
        </View>
        {problem && <Text style={s.error}>{problem}</Text>}
        {failed && <Text style={s.error}>Could not load habits. Pull down to retry.</Text>}
        {habits === null && !failed && (
          <ActivityIndicator color={C.primary} style={{ marginTop: 24 }} />
        )}
        {habits?.length === 0 && <Text style={s.muted}>No habits yet. Add one above.</Text>}
        {habits?.map((h) => (
          <Pressable
            key={h.id}
            style={[s.row, h.doneToday && s.rowDone, working === h.id && { opacity: 0.6 }]}
            onPress={() => toggle(h)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: h.doneToday }}
            accessibilityLabel={h.name}
          >
            <View style={[s.box, h.doneToday && s.boxDone]}>
              {h.doneToday && <Text style={s.tick}>✓</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{h.name}</Text>
              <Text style={s.meta}>
                {h.cadence === "daily" && h.streak > 0 ? `${h.streak}-day streak · ` : ""}
                {h.progress}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  page: { padding: 16, paddingBottom: 32 },
  tiles: { flexDirection: "row", gap: 12, marginBottom: 12 },
  tile: {
    flex: 1,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 14,
  },
  num: { fontSize: 28, fontWeight: "800", color: C.primary },
  tileLabel: { color: C.muted, fontSize: 12, marginTop: 2 },
  addRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  input: {
    flex: 1,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 12,
    color: C.text,
  },
  add: {
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  addText: { color: "#fff", fontWeight: "700" },
  error: { color: C.danger, marginBottom: 8 },
  muted: { color: C.muted, marginTop: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  rowDone: { borderColor: C.primary },
  box: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  boxDone: { backgroundColor: C.primary, borderColor: C.primary },
  tick: { color: "#fff", fontWeight: "800", fontSize: 14 },
  name: { color: C.text, fontWeight: "600" },
  meta: { color: C.muted, fontSize: 12, marginTop: 2 },
});
