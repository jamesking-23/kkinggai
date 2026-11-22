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
  APPLICATION_STATUSES,
  cleanLine,
  dueSoon,
  filterApplications,
  pipelineCounts,
  statusLabel,
  statusPatch,
  type ApplicationRow,
  type ApplicationStatus,
} from "./career";
import { deadlineLabel } from "./goals";
import { ScreenHeader } from "./ScreenHeader";
import { supabase } from "./supabase";
import { C } from "./theme";

/** Native career tracker: pipeline counts, deadlines coming up, filter and search, move an application between stages, add one. Interview prep, CV and portfolio stay on the website. */
export function CareerScreen({ onBack, onOpenWeb }: { onBack: () => void; onOpenWeb: () => void }) {
  const [apps, setApps] = useState<ApplicationRow[] | null>(null);
  const [today, setToday] = useState("");
  const [failed, setFailed] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [filter, setFilter] = useState<ApplicationStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    const settings = await supabase.from("user_settings").select("timezone").maybeSingle();
    setToday(localDate(new Date().toISOString(), safeZone(settings.data?.timezone)));
    const r = await supabase
      .from("job_applications")
      .select("id, company, role, status, location, applied_on, deadline, revision")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .overrideTypes<ApplicationRow[]>();
    if (r.error) return setFailed(true);
    setApps(r.data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => pipelineCounts(apps ?? []), [apps]);
  const soon = useMemo(() => dueSoon(apps ?? [], today), [apps, today]);
  const shown = useMemo(() => filterApplications(apps ?? [], filter, query), [apps, filter, query]);

  async function move(app: ApplicationRow, status: ApplicationStatus) {
    if (working || status === app.status) return;
    setWorking(app.id);
    setProblem(null);
    const { data, error } = await supabase
      .from("job_applications")
      .update(statusPatch(status, !!app.applied_on, today))
      .eq("id", app.id)
      .eq("revision", app.revision)
      .select("id");
    setWorking(null);
    if (error) return setProblem("Could not update the application.");
    if (!data || data.length === 0)
      setProblem("This application was changed elsewhere. It has been refreshed; try again.");
    load();
  }

  async function add() {
    const c = cleanLine(company);
    const r = cleanLine(role);
    if (!c || !r || working) return setProblem("Enter both the company and the role.");
    setWorking("add");
    setProblem(null);
    const { error } = await supabase
      .from("job_applications")
      .insert({ company: c, role: r, status: "wishlist" });
    setWorking(null);
    if (error) return setProblem("Could not save the application. Try again.");
    setCompany("");
    setRole("");
    setAdding(false);
    load();
  }

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Career" onBack={onBack} action={{ label: "More", onPress: onOpenWeb }} />
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
        {apps && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.chips}
          >
            <Chip
              label={`All ${apps.length}`}
              active={filter === "all"}
              onPress={() => setFilter("all")}
            />
            {counts.map((c) => (
              <Chip
                key={c.status}
                label={`${statusLabel(c.status)} ${c.count}`}
                active={filter === c.status}
                onPress={() => setFilter(c.status)}
              />
            ))}
          </ScrollView>
        )}

        {soon.length > 0 && (
          <View style={s.soon}>
            <Text style={s.soonTitle}>Deadlines in the next 14 days</Text>
            {soon.map((x) => (
              <Text key={x.id} style={s.soonRow}>
                {x.company} · {x.role} — {deadlineLabel(x.deadline, today)}
              </Text>
            ))}
          </View>
        )}

        <TextInput
          style={s.input}
          placeholder="Search company or role"
          placeholderTextColor={C.muted}
          value={query}
          onChangeText={setQuery}
        />

        {adding ? (
          <View style={s.card}>
            <TextInput
              style={s.input}
              placeholder="Company"
              placeholderTextColor={C.muted}
              value={company}
              onChangeText={setCompany}
            />
            <TextInput
              style={s.input}
              placeholder="Role"
              placeholderTextColor={C.muted}
              value={role}
              onChangeText={setRole}
            />
            <View style={s.row}>
              <Pressable
                style={[s.btn, working === "add" && { opacity: 0.5 }]}
                disabled={working === "add"}
                onPress={add}
              >
                <Text style={s.btnText}>Save to wishlist</Text>
              </Pressable>
              <Pressable style={s.ghost} onPress={() => setAdding(false)}>
                <Text style={s.ghostText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={s.addBtn} onPress={() => setAdding(true)}>
            <Text style={s.btnText}>+ Add application</Text>
          </Pressable>
        )}

        {problem && <Text style={s.error}>{problem}</Text>}
        {failed && <Text style={s.error}>Could not load applications. Pull down to retry.</Text>}
        {apps === null && !failed && (
          <ActivityIndicator color={C.primary} style={{ marginTop: 24 }} />
        )}
        {apps && shown.length === 0 && (
          <Text style={s.muted}>
            {apps.length === 0 ? "No applications yet." : "Nothing matches."}
          </Text>
        )}

        {shown.map((app) => (
          <Pressable
            key={app.id}
            style={s.card}
            onPress={() => setOpen(open === app.id ? null : app.id)}
          >
            <View style={s.top}>
              <View style={{ flex: 1 }}>
                <Text style={s.company}>{app.company}</Text>
                <Text style={s.role}>{app.role}</Text>
              </View>
              <Text style={s.badge}>{statusLabel(app.status)}</Text>
            </View>
            {(app.deadline || app.location) && (
              <Text style={s.meta}>
                {[app.location, app.deadline ? deadlineLabel(app.deadline, today) : ""]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            )}
            {open === app.id && (
              <View style={s.moves}>
                {APPLICATION_STATUSES.filter((st) => st !== app.status).map((st) => (
                  <Pressable
                    key={st}
                    style={[s.ghost, working === app.id && { opacity: 0.5 }]}
                    disabled={working === app.id}
                    onPress={() => move(app, st)}
                  >
                    <Text style={s.ghostText}>{statusLabel(st)}</Text>
                  </Pressable>
                ))}
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
  soon: {
    backgroundColor: "#fff7e0",
    borderWidth: 1,
    borderColor: C.primary,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  soonTitle: { fontWeight: "700", color: C.text, marginBottom: 4 },
  soonRow: { color: C.text, fontSize: 13, marginTop: 2 },
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
  muted: { color: C.muted, marginTop: 12 },
  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  top: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  company: { color: C.text, fontWeight: "700", fontSize: 16 },
  role: { color: C.muted, marginTop: 2 },
  badge: { color: C.primary, fontSize: 12, fontWeight: "700" },
  meta: { color: C.muted, fontSize: 12, marginTop: 6 },
  moves: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
});
