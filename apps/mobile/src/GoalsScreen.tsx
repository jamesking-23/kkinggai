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
import {
  deadlineLabel,
  goalProgress,
  parseValue,
  sortGoals,
  valueText,
  type GoalRow,
  type MilestoneRow,
} from "./goals";
import { ScreenHeader } from "./ScreenHeader";
import { supabase } from "./supabase";
import { C } from "./theme";

/** Native goals: progress bars, update the current value, tick milestones, mark a goal achieved. Creating and editing goals is on the website. */
export function GoalsScreen({ onBack, onOpenWeb }: { onBack: () => void; onOpenWeb: () => void }) {
  const [goals, setGoals] = useState<GoalRow[] | null>(null);
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [today, setToday] = useState("");
  const [failed, setFailed] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    const settings = await supabase.from("user_settings").select("timezone").maybeSingle();
    setToday(localDate(new Date().toISOString(), safeZone(settings.data?.timezone)));
    const g = await supabase
      .from("goals")
      .select("id, title, target_value, current_value, unit, deadline, status, revision")
      .order("created_at", { ascending: false })
      .overrideTypes<GoalRow[]>();
    if (g.error) return setFailed(true);
    const list = g.data ?? [];
    const m = list.length
      ? await supabase
          .from("milestones")
          .select("id, goal_id, title, due_date, completed_at")
          .in(
            "goal_id",
            list.map((x) => x.id),
          )
          .order("created_at")
          .overrideTypes<MilestoneRow[]>()
      : { data: [] as MilestoneRow[], error: null };
    if (m.error) return setFailed(true);
    setGoals(sortGoals(list));
    setMilestones(m.data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveProgress(goal: GoalRow) {
    const value = parseValue(draft);
    if (value === null) return setProblem("Enter a number, for example 12 or 3.5.");
    setWorking(goal.id);
    setProblem(null);
    const { data, error } = await supabase
      .from("goals")
      .update({ current_value: value })
      .eq("id", goal.id)
      .eq("revision", goal.revision)
      .select("id");
    setWorking(null);
    if (error) return setProblem("Could not save. Check your connection.");
    if (!data || data.length === 0) {
      setProblem("This goal was changed elsewhere. It has been refreshed; try again.");
    } else {
      setEditing(null);
    }
    load();
  }

  async function markAchieved(goal: GoalRow) {
    setWorking(goal.id);
    setProblem(null);
    const { data, error } = await supabase
      .from("goals")
      .update({ status: "achieved" })
      .eq("id", goal.id)
      .eq("revision", goal.revision)
      .select("id");
    setWorking(null);
    if (error) return setProblem("Could not update the goal.");
    if (!data || data.length === 0)
      setProblem("This goal was changed elsewhere. It has been refreshed.");
    load();
  }

  async function toggleMilestone(m: MilestoneRow) {
    if (working) return;
    setWorking(m.id);
    setProblem(null);
    const { error } = await supabase
      .from("milestones")
      .update({ completed_at: m.completed_at ? null : new Date().toISOString() })
      .eq("id", m.id);
    setWorking(null);
    if (error) return setProblem("Could not update the milestone.");
    load();
  }

  const active = goals?.filter((x) => x.status === "active").length ?? 0;
  const achieved = goals?.filter((x) => x.status === "achieved").length ?? 0;

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader
        title="Goals"
        onBack={onBack}
        action={{ label: "Add / edit", onPress: onOpenWeb }}
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
        {goals && (
          <View style={s.tiles}>
            <View style={s.tile}>
              <Text style={s.num}>{active}</Text>
              <Text style={s.tileLabel}>Active</Text>
            </View>
            <View style={s.tile}>
              <Text style={s.num}>{achieved}</Text>
              <Text style={s.tileLabel}>Achieved</Text>
            </View>
          </View>
        )}
        {problem && <Text style={s.error}>{problem}</Text>}
        {failed && <Text style={s.error}>Could not load goals. Pull down to retry.</Text>}
        {goals === null && !failed && (
          <ActivityIndicator color={C.primary} style={{ marginTop: 24 }} />
        )}
        {goals?.length === 0 && <Text style={s.muted}>No goals yet. Add one on the website.</Text>}
        {goals?.map((goal) => {
          const pct = goalProgress(goal.current_value, goal.target_value);
          const ms = milestones.filter((m) => m.goal_id === goal.id);
          const label = goal.status === "active" ? deadlineLabel(goal.deadline, today) : "";
          return (
            <View key={goal.id} style={[s.card, goal.status !== "active" && { opacity: 0.7 }]}>
              <View style={s.top}>
                <Text style={s.title} numberOfLines={2}>
                  {goal.title}
                </Text>
                {goal.status !== "active" && <Text style={s.badge}>{goal.status}</Text>}
              </View>
              <Text style={s.meta}>
                {valueText(goal)}
                {label ? ` · ${label}` : ""}
              </Text>
              {pct !== null && (
                <View style={s.bar} accessibilityLabel={`${pct} percent`}>
                  <View style={[s.fill, { width: `${pct}%` }]} />
                </View>
              )}
              {ms.map((m) => (
                <Pressable
                  key={m.id}
                  style={s.ms}
                  onPress={() => toggleMilestone(m)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: !!m.completed_at }}
                >
                  <Text style={s.msBox}>{m.completed_at ? "☑" : "☐"}</Text>
                  <Text style={[s.msTitle, m.completed_at && s.msDone]}>{m.title}</Text>
                </Pressable>
              ))}
              {goal.status === "active" &&
                (editing === goal.id ? (
                  <View style={s.editRow}>
                    <TextInput
                      style={s.input}
                      keyboardType="decimal-pad"
                      value={draft}
                      onChangeText={setDraft}
                      placeholder="Current value"
                      placeholderTextColor={C.muted}
                      autoFocus
                    />
                    <Pressable
                      style={[s.btn, working === goal.id && { opacity: 0.5 }]}
                      disabled={working === goal.id}
                      onPress={() => saveProgress(goal)}
                    >
                      <Text style={s.btnText}>Save</Text>
                    </Pressable>
                    <Pressable style={s.btnGhost} onPress={() => setEditing(null)}>
                      <Text style={s.btnGhostText}>Cancel</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={s.editRow}>
                    <Pressable
                      style={s.btnGhost}
                      onPress={() => {
                        setEditing(goal.id);
                        setDraft(String(goal.current_value));
                        setProblem(null);
                      }}
                    >
                      <Text style={s.btnGhostText}>Update progress</Text>
                    </Pressable>
                    <Pressable
                      style={[s.btnGhost, working === goal.id && { opacity: 0.5 }]}
                      disabled={working === goal.id}
                      onPress={() => markAchieved(goal)}
                    >
                      <Text style={s.btnGhostText}>Mark achieved</Text>
                    </Pressable>
                  </View>
                ))}
            </View>
          );
        })}
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
  top: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  title: { flex: 1, color: C.text, fontWeight: "700", fontSize: 16 },
  badge: { color: C.muted, fontSize: 11, textTransform: "capitalize" },
  meta: { color: C.muted, fontSize: 12, marginTop: 4 },
  bar: { height: 8, borderRadius: 4, backgroundColor: C.border, marginTop: 10, overflow: "hidden" },
  fill: { height: 8, backgroundColor: C.primary },
  ms: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, marginTop: 2 },
  msBox: { color: C.primary, fontSize: 16 },
  msTitle: { color: C.text, flex: 1 },
  msDone: { color: C.muted, textDecorationLine: "line-through" },
  editRow: { flexDirection: "row", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" },
  input: {
    flex: 1,
    minWidth: 110,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 10,
    color: C.text,
  },
  btn: { backgroundColor: C.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  btnText: { color: "#fff", fontWeight: "700" },
  btnGhost: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  btnGhostText: { color: C.primary, fontWeight: "600", fontSize: 13 },
});
