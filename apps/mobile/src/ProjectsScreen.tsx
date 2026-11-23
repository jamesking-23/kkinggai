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
  checkProject,
  nextStatuses,
  openCounts,
  sortProjects,
  statusLabel,
  type ProjectRow,
  type ProjectStatus,
} from "./projects";
import { ScreenHeader } from "./ScreenHeader";
import { supabase } from "./supabase";
import { C } from "./theme";

type OpenTask = { id: string; title: string; project_id: string | null; due_date: string | null };

/** Native projects: list with status, due date and open-task counts; tap a project for its open tasks and to change its status; add a project. Editing details and managing tasks stay on the website. */
export function ProjectsScreen({
  onBack,
  onOpenWeb,
}: {
  onBack: () => void;
  onOpenWeb: () => void;
}) {
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [tasks, setTasks] = useState<OpenTask[]>([]);
  const [wsId, setWsId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [due, setDue] = useState("");

  const load = useCallback(async () => {
    setFailed(false);
    const [p, t, w] = await Promise.all([
      supabase
        .from("projects")
        .select("id, name, description, status, due_date, revision")
        .neq("status", "archived")
        .order("created_at", { ascending: false })
        .overrideTypes<ProjectRow[]>(),
      supabase
        .from("tasks")
        .select("id, title, project_id, due_date")
        .is("deleted_at", null)
        .in("status", ["todo", "in_progress"])
        .not("project_id", "is", null)
        .order("due_date", { nullsFirst: false })
        .limit(1000)
        .overrideTypes<OpenTask[]>(),
      supabase.from("workspaces").select("id").order("created_at").limit(1).maybeSingle(),
    ]);
    if (p.error || t.error) return setFailed(true);
    setProjects(sortProjects(p.data ?? []));
    setTasks(t.data ?? []);
    setWsId(w.data?.id ?? null);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => openCounts(tasks), [tasks]);

  async function add() {
    const v = checkProject(name, desc, due);
    if (typeof v === "string") return setProblem(v);
    if (!wsId) return setProblem("Could not find your workspace.");
    if (working) return;
    setWorking("add");
    setProblem(null);
    const { error } = await supabase
      .from("projects")
      .insert({ workspace_id: wsId, name: v.name, description: v.description, due_date: v.due });
    setWorking(null);
    if (error) return setProblem("Could not create the project. Try again.");
    setName("");
    setDesc("");
    setDue("");
    setAdding(false);
    load();
  }

  async function move(p: ProjectRow, status: ProjectStatus) {
    if (working) return;
    setWorking(p.id);
    setProblem(null);
    const { data, error } = await supabase
      .from("projects")
      .update({ status })
      .eq("id", p.id)
      .eq("revision", p.revision)
      .select("id");
    setWorking(null);
    if (error) return setProblem("Could not update the project.");
    if (!data || data.length === 0)
      setProblem("This project was changed elsewhere. It has been refreshed; try again.");
    load();
  }

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader
        title="Projects"
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
              placeholder="Project name"
              placeholderTextColor={C.muted}
              value={name}
              onChangeText={setName}
              autoFocus
            />
            <TextInput
              style={s.input}
              placeholder="Description (optional)"
              placeholderTextColor={C.muted}
              value={desc}
              onChangeText={setDesc}
            />
            <TextInput
              style={s.input}
              placeholder="Due date YYYY-MM-DD (optional)"
              placeholderTextColor={C.muted}
              value={due}
              onChangeText={setDue}
              keyboardType="numbers-and-punctuation"
            />
            <View style={s.row}>
              <Pressable
                style={[s.btn, working === "add" && { opacity: 0.5 }]}
                disabled={working === "add"}
                onPress={add}
              >
                <Text style={s.btnText}>Create</Text>
              </Pressable>
              <Pressable style={s.ghost} onPress={() => setAdding(false)}>
                <Text style={s.ghostText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={s.addBtn} onPress={() => setAdding(true)}>
            <Text style={s.btnText}>+ New project</Text>
          </Pressable>
        )}

        {problem && <Text style={s.error}>{problem}</Text>}
        {failed && <Text style={s.error}>Could not load projects. Pull down to retry.</Text>}
        {projects === null && !failed && <ActivityIndicator color={C.primary} />}
        {projects && projects.length === 0 && <Text style={s.muted}>No projects yet.</Text>}

        {projects?.map((p) => {
          const mine = tasks.filter((t) => t.project_id === p.id);
          return (
            <Pressable
              key={p.id}
              style={s.card}
              onPress={() => setOpen(open === p.id ? null : p.id)}
            >
              <Text style={s.title}>{p.name}</Text>
              <Text style={s.meta}>
                {[
                  statusLabel(p.status),
                  `${counts.get(p.id) ?? 0} open task${(counts.get(p.id) ?? 0) === 1 ? "" : "s"}`,
                  p.due_date ? `due ${p.due_date}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
              {open === p.id && (
                <View>
                  {!!p.description && <Text style={s.desc}>{p.description}</Text>}
                  {mine.length === 0 ? (
                    <Text style={s.muted}>No open tasks.</Text>
                  ) : (
                    mine.slice(0, 20).map((t) => (
                      <Text key={t.id} style={s.task}>
                        • {t.title}
                        {t.due_date ? `  (${t.due_date})` : ""}
                      </Text>
                    ))
                  )}
                  {mine.length > 20 && <Text style={s.muted}>and {mine.length - 20} more</Text>}
                  <View style={s.moves}>
                    {nextStatuses(p.status).map((st) => (
                      <Pressable
                        key={st}
                        style={[s.ghost, working === p.id && { opacity: 0.5 }]}
                        disabled={working === p.id}
                        onPress={() => move(p, st)}
                      >
                        <Text style={s.ghostText}>
                          {st === "active" ? "Reactivate" : statusLabel(st)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
            </Pressable>
          );
        })}
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
  muted: { color: C.muted, marginTop: 8 },
  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  title: { color: C.text, fontWeight: "700", fontSize: 15 },
  meta: { color: C.muted, fontSize: 12, marginTop: 4 },
  desc: { color: C.text, marginTop: 10, lineHeight: 20 },
  task: { color: C.text, marginTop: 6 },
  moves: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
});
