import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { safeZone } from "./agenda";
import {
  dueText,
  isOpen,
  phoneMoves,
  scoreText,
  sortAssignments,
  statusText,
  summarize,
  type AssignmentRow,
  type CourseRow,
} from "./academics";
import { ScreenHeader } from "./ScreenHeader";
import { supabase } from "./supabase";
import { C } from "./theme";

/** Native academics: the four counts, assignments by urgency (move between to do, in progress and submitted), and your active courses. Adding courses and assignments, grading and notes stay on the website. */
export function AcademicsScreen({
  onBack,
  onOpenWeb,
}: {
  onBack: () => void;
  onOpenWeb: () => void;
}) {
  const [courses, setCourses] = useState<CourseRow[] | null>(null);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [tz, setTz] = useState("UTC");
  const [failed, setFailed] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    const [settings, c, a] = await Promise.all([
      supabase.from("user_settings").select("timezone").maybeSingle(),
      supabase
        .from("courses")
        .select("id, code, name, status")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .overrideTypes<CourseRow[]>(),
      supabase
        .from("assignments")
        .select("id, course_id, title, due_at, status, score, max_score, revision")
        .is("deleted_at", null)
        .order("due_at", { ascending: true, nullsFirst: false })
        .overrideTypes<AssignmentRow[]>(),
    ]);
    if (c.error || a.error) return setFailed(true);
    setTz(safeZone(settings.data?.timezone));
    setCourses(c.data ?? []);
    setAssignments(sortAssignments(a.data ?? []));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const names = useMemo(
    () => new Map((courses ?? []).map((c) => [c.id, c.code ? `${c.code} · ${c.name}` : c.name])),
    [courses],
  );
  const sum = useMemo(
    () => summarize(courses ?? [], assignments, Date.now()),
    [courses, assignments],
  );

  async function move(a: AssignmentRow, status: AssignmentRow["status"]) {
    if (working) return;
    setWorking(a.id);
    setProblem(null);
    const { data, error } = await supabase
      .from("assignments")
      .update({ status })
      .eq("id", a.id)
      .eq("revision", a.revision)
      .select("id");
    setWorking(null);
    if (error) return setProblem("Could not update the assignment.");
    if (!data || data.length === 0)
      setProblem("This assignment was changed elsewhere. It has been refreshed; try again.");
    load();
  }

  const now = new Date();

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader
        title="Academics"
        onBack={onBack}
        action={{ label: "More", onPress: onOpenWeb }}
      />
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
        {courses && (
          <View style={s.tiles}>
            <Tile n={sum.activeCourses} label="Active courses" />
            <Tile n={sum.open} label="Open assignments" />
            <Tile n={sum.dueSoon} label="Due in 7 days" />
            <Tile n={sum.overdue} label="Overdue" danger={sum.overdue > 0} />
          </View>
        )}
        {problem && <Text style={s.error}>{problem}</Text>}
        {failed && <Text style={s.error}>Could not load academics. Pull down to retry.</Text>}
        {courses === null && !failed && (
          <ActivityIndicator color={C.primary} style={{ marginTop: 24 }} />
        )}

        {courses && <Text style={s.section}>Assignments</Text>}
        {courses && assignments.length === 0 && (
          <Text style={s.muted}>No assignments yet. Add them on the website.</Text>
        )}
        {assignments.map((a) => (
          <Pressable
            key={a.id}
            style={[s.card, !isOpen(a) && { opacity: 0.7 }]}
            onPress={() => setOpen(open === a.id ? null : a.id)}
          >
            <View style={s.top}>
              <Text style={s.title} numberOfLines={2}>
                {a.title}
              </Text>
              <Text style={s.badge}>{statusText(a.status)}</Text>
            </View>
            <Text style={s.meta}>
              {[
                a.course_id ? names.get(a.course_id) : null,
                isOpen(a)
                  ? dueText(a.due_at, tz, now)
                  : scoreText(a) || dueText(a.due_at, tz, now, false),
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
            {open === a.id && a.status !== "graded" && (
              <View style={s.moves}>
                {phoneMoves(a.status).map((st) => (
                  <Pressable
                    key={st}
                    style={[s.ghost, working === a.id && { opacity: 0.5 }]}
                    disabled={working === a.id}
                    onPress={() => move(a, st)}
                  >
                    <Text style={s.ghostText}>{statusText(st)}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </Pressable>
        ))}

        {courses && courses.some((c) => c.status === "active") && (
          <Text style={s.section}>Active courses</Text>
        )}
        {courses
          ?.filter((c) => c.status === "active")
          .map((c) => (
            <View key={c.id} style={s.course}>
              <Text style={s.title}>{c.code ? `${c.code} · ${c.name}` : c.name}</Text>
            </View>
          ))}
      </ScrollView>
    </View>
  );
}

function Tile({ n, label, danger }: { n: number; label: string; danger?: boolean }) {
  return (
    <View style={s.tile}>
      <Text style={[s.num, danger && { color: C.danger }]}>{n}</Text>
      <Text style={s.tileLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  page: { padding: 16, paddingBottom: 32 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 8 },
  tile: {
    width: "48%",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 14,
  },
  num: { fontSize: 28, fontWeight: "800", color: C.primary },
  tileLabel: { color: C.muted, fontSize: 12, marginTop: 2 },
  section: { fontSize: 17, fontWeight: "700", color: C.text, marginTop: 14, marginBottom: 8 },
  error: { color: C.danger, marginVertical: 8 },
  muted: { color: C.muted },
  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  top: { flexDirection: "row", gap: 8, justifyContent: "space-between" },
  title: { flex: 1, color: C.text, fontWeight: "600" },
  badge: { color: C.primary, fontSize: 12, fontWeight: "700" },
  meta: { color: C.muted, fontSize: 12, marginTop: 4 },
  moves: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  ghost: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ghostText: { color: C.primary, fontWeight: "600", fontSize: 13 },
  course: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
  },
});
