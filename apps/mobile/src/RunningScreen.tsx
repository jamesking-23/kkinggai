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
  cleanName,
  formatDuration,
  formatKm,
  formatPace,
  KIND_LABELS,
  parseDistanceM,
  parseDurationSeconds,
  RUN_KINDS,
  startedAt,
  summarise,
  type RunKind,
  type RunRow,
} from "./running";
import { ScreenHeader } from "./ScreenHeader";
import { supabase } from "./supabase";
import { C } from "./theme";

/** Native running log: weekly/monthly/all-time totals, an 8-week distance chart, recent runs, and adding a manual run. GPX import, routes, heart-rate zones, plans and the coach stay on the website. */
export function RunningScreen({
  onBack,
  onOpenWeb,
}: {
  onBack: () => void;
  onOpenWeb: () => void;
}) {
  const [runs, setRuns] = useState<RunRow[] | null>(null);
  const [zone, setZone] = useState("UTC");
  const [failed, setFailed] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<RunKind>("easy");
  const [km, setKm] = useState("");
  const [hh, setHh] = useState("");
  const [mm, setMm] = useState("");
  const [ss, setSs] = useState("");

  const load = useCallback(async () => {
    setFailed(false);
    const st = await supabase.from("user_settings").select("timezone").maybeSingle();
    setZone(safeZone(st.data?.timezone));
    const r = await supabase
      .from("run_activities")
      .select("id, name, kind, started_at, distance_m, moving_seconds")
      .is("deleted_at", null)
      .order("started_at", { ascending: false })
      .limit(2000)
      .overrideTypes<RunRow[]>();
    if (r.error) return setFailed(true);
    setRuns(r.data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const today = localDate(new Date().toISOString(), zone);
  const sum = useMemo(
    () => summarise(runs ?? [], today, (iso) => localDate(iso, zone)),
    [runs, today, zone],
  );
  const maxWeek = Math.max(1, ...sum.weeks.map((w) => w.distanceM));

  async function save() {
    if (saving) return;
    const n = cleanName(name);
    const dist = parseDistanceM(km);
    const secs = parseDurationSeconds(hh, mm, ss);
    if (!n) return setProblem("Enter a name.");
    if (dist === null) return setProblem("Enter a distance between 0.01 and 1000 km.");
    if (secs === null) return setProblem("Enter the time it took (minutes up to 59).");
    setSaving(true);
    setProblem(null);
    const { error } = await supabase.from("run_activities").insert({
      source: "manual",
      name: n,
      kind,
      started_at: startedAt(today),
      distance_m: dist,
      moving_seconds: secs,
      notes: "",
    });
    setSaving(false);
    if (error) return setProblem("Could not save the run. Try again.");
    setName("");
    setKm("");
    setHh("");
    setMm("");
    setSs("");
    setKind("easy");
    setAdding(false);
    load();
  }

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader
        title="Running"
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
        {failed && <Text style={s.error}>Could not load runs. Pull down to retry.</Text>}
        {runs === null && !failed && <ActivityIndicator color={C.primary} />}

        {runs && (
          <>
            <View style={s.tiles}>
              {(
                [
                  ["This week", sum.week],
                  ["This month", sum.month],
                  ["All time", sum.all],
                ] as const
              ).map(([label, t]) => (
                <View key={label} style={s.tile}>
                  <Text style={s.tileLabel}>{label}</Text>
                  <Text style={s.tileValue}>{t.runs ? formatKm(t.distanceM) : "–"}</Text>
                  <Text style={s.tileHint}>
                    {t.runs
                      ? `${t.runs} run${t.runs === 1 ? "" : "s"} · ${formatDuration(t.movingSeconds)}`
                      : "No runs"}
                  </Text>
                </View>
              ))}
            </View>

            {sum.all.runs > 0 && (
              <View style={s.card}>
                <Text style={s.h}>Weekly distance (km)</Text>
                <View style={s.bars}>
                  {sum.weeks.map((w) => (
                    <View key={w.weekStart} style={s.barCol}>
                      <Text style={s.barNum}>{w.runs ? (w.distanceM / 1000).toFixed(0) : ""}</Text>
                      <View
                        style={[
                          s.bar,
                          {
                            height: `${Math.max(w.runs ? 4 : 1, (w.distanceM / maxWeek) * 100)}%`,
                            backgroundColor: w.runs ? C.primary : C.border,
                          },
                        ]}
                      />
                      <Text style={s.barNum}>{w.weekStart.slice(5)}</Text>
                    </View>
                  ))}
                </View>
                <Text style={s.tileHint}>Weeks start on Monday ({zone}).</Text>
              </View>
            )}
          </>
        )}

        {adding ? (
          <View style={s.card}>
            <TextInput
              style={s.input}
              placeholder="Name, e.g. Morning run"
              placeholderTextColor={C.muted}
              value={name}
              onChangeText={setName}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.chips}
            >
              {RUN_KINDS.map((k) => (
                <Pressable
                  key={k}
                  onPress={() => setKind(k)}
                  style={[s.chip, kind === k && s.chipOn]}
                >
                  <Text style={[s.chipText, kind === k && s.chipTextOn]}>{KIND_LABELS[k]}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <TextInput
              style={s.input}
              placeholder="Distance (km)"
              placeholderTextColor={C.muted}
              value={km}
              onChangeText={setKm}
              keyboardType="decimal-pad"
            />
            <View style={s.row}>
              {(
                [
                  ["h", hh, setHh],
                  ["min", mm, setMm],
                  ["sec", ss, setSs],
                ] as const
              ).map(([label, v, set]) => (
                <TextInput
                  key={label}
                  style={[s.input, { flex: 1, marginBottom: 0 }]}
                  placeholder={label}
                  placeholderTextColor={C.muted}
                  value={v}
                  onChangeText={set}
                  keyboardType="number-pad"
                />
              ))}
            </View>
            <Text style={s.tileHint}>Dated today ({today}).</Text>
            <View style={[s.row, { marginTop: 10 }]}>
              <Pressable
                style={[s.btn, saving && { opacity: 0.5 }]}
                disabled={saving}
                onPress={save}
              >
                <Text style={s.btnText}>Save run</Text>
              </Pressable>
              <Pressable style={s.ghost} onPress={() => setAdding(false)}>
                <Text style={s.ghostText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={s.addBtn} onPress={() => setAdding(true)}>
            <Text style={s.btnText}>+ Add a run</Text>
          </Pressable>
        )}
        {problem && <Text style={s.error}>{problem}</Text>}

        {runs && runs.length === 0 && <Text style={s.muted}>No runs yet. Add one above.</Text>}
        {runs?.slice(0, 30).map((r) => (
          <View key={r.id} style={s.card}>
            <View style={s.top}>
              <Text style={s.title} numberOfLines={2}>
                {r.name}
              </Text>
              <Text style={s.badge}>{formatKm(r.distance_m)}</Text>
            </View>
            <Text style={s.meta}>
              {[
                localDate(r.started_at, zone),
                KIND_LABELS[r.kind] ?? r.kind,
                formatDuration(r.moving_seconds),
                formatPace(r.distance_m, r.moving_seconds),
              ].join(" · ")}
            </Text>
          </View>
        ))}
        {runs && runs.length > 30 && (
          <Text style={s.muted}>
            Showing the 30 most recent of {runs.length}. See all on the website.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  page: { padding: 16, paddingBottom: 32 },
  tiles: { flexDirection: "row", gap: 8, marginBottom: 12 },
  tile: {
    flex: 1,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 10,
  },
  tileLabel: { color: C.muted, fontSize: 11 },
  tileValue: { color: C.text, fontWeight: "800", fontSize: 17, marginTop: 2 },
  tileHint: { color: C.muted, fontSize: 11, marginTop: 2 },
  h: { color: C.text, fontWeight: "700", marginBottom: 8 },
  bars: { flexDirection: "row", gap: 4, height: 120, alignItems: "flex-end" },
  barCol: { flex: 1, height: "100%", justifyContent: "flex-end", alignItems: "center", gap: 2 },
  bar: { width: "100%", borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barNum: { color: C.muted, fontSize: 9 },
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
  row: { flexDirection: "row", gap: 8, marginBottom: 4 },
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
  badge: { color: C.primary, fontSize: 13, fontWeight: "700" },
  meta: { color: C.muted, fontSize: 12, marginTop: 4 },
});
