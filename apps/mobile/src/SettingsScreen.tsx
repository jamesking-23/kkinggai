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
import { ScreenHeader } from "./ScreenHeader";
import { canManageRole, checkProfile, moduleViews, type RegistryModule } from "./settings";
import { supabase } from "./supabase";
import { C } from "./theme";

type Registry = RegistryModule & { version: string };

/** Native settings: your name and time zone, and which modules are on in this workspace (owners and admins). App updates are in the Account tab. */
export function SettingsScreen({
  onBack,
  onOpenWeb,
}: {
  onBack: () => void;
  onOpenWeb: () => void;
}) {
  const [name, setName] = useState("");
  const [zone, setZone] = useState("");
  const [email, setEmail] = useState("");
  const [wsId, setWsId] = useState<string | null>(null);
  const [wsName, setWsName] = useState("");
  const [registry, setRegistry] = useState<Registry[] | null>(null);
  const [state, setState] = useState<Map<string, boolean>>(new Map());
  const [canManage, setCanManage] = useState(false);
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) return setFailed(true);
    setEmail(u.user?.email ?? "");
    const [p, st, w] = await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", uid).maybeSingle(),
      supabase.from("user_settings").select("timezone").maybeSingle(),
      supabase.from("workspaces").select("id, name").order("created_at").limit(1).maybeSingle(),
    ]);
    if (!w.data) return setFailed(true);
    setName(p.data?.display_name ?? "");
    setZone(st.data?.timezone ?? "UTC");
    setWsId(w.data.id);
    setWsName(w.data.name);
    const [reg, mods, member] = await Promise.all([
      supabase
        .from("module_registry")
        .select("id, name, description, core, dependencies, status, version")
        .order("nav_order")
        .overrideTypes<Registry[], { merge: false }>(),
      supabase.from("workspace_modules").select("module_id, enabled").eq("workspace_id", w.data.id),
      supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", w.data.id)
        .eq("user_id", uid)
        .maybeSingle(),
    ]);
    if (reg.error || mods.error) return setFailed(true);
    setRegistry(reg.data ?? []);
    setState(new Map((mods.data ?? []).map((m) => [m.module_id as string, m.enabled as boolean])));
    setCanManage(canManageRole(member.data?.role));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const views = useMemo(
    () => moduleViews(registry ?? [], state, canManage),
    [registry, state, canManage],
  );

  async function saveProfile() {
    if (saving) return;
    const v = checkProfile(name, zone);
    setMessage(null);
    if (typeof v === "string") return setProblem(v);
    setSaving(true);
    setProblem(null);
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) {
      setSaving(false);
      return setProblem("You are signed out. Sign in again.");
    }
    const [p, s] = await Promise.all([
      supabase.from("profiles").update({ display_name: v.displayName }).eq("id", uid),
      supabase.from("user_settings").update({ timezone: v.timezone }).eq("user_id", uid),
    ]);
    setSaving(false);
    if (p.error || s.error) return setProblem("Could not save your changes.");
    setName(v.displayName);
    setZone(v.timezone);
    setMessage("Saved");
  }

  async function toggle(id: string, enable: boolean) {
    if (!wsId || toggling) return;
    setToggling(id);
    setProblem(null);
    setMessage(null);
    const { data, error } = await supabase
      .from("workspace_modules")
      .update({ enabled: enable })
      .eq("workspace_id", wsId)
      .eq("module_id", id)
      .select("module_id");
    setToggling(null);
    if (error)
      return setProblem(error.code === "23514" ? error.message : "Could not change the module.");
    if (!data || data.length === 0)
      return setProblem("Only workspace owners and admins can change modules.");
    setMessage(enable ? "Module enabled" : "Module disabled");
    load();
  }

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader
        title="Settings"
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
        {failed && <Text style={s.error}>Could not load settings. Pull down to retry.</Text>}
        {!failed && registry === null && <ActivityIndicator color={C.primary} />}
        {problem && <Text style={s.error}>{problem}</Text>}
        {message && <Text style={s.ok}>{message}</Text>}

        {registry && (
          <>
            <View style={s.card}>
              <Text style={s.group}>Profile</Text>
              <Text style={s.meta}>Signed in as {email}</Text>
              <Text style={s.label}>Name</Text>
              <TextInput
                style={s.input}
                value={name}
                onChangeText={setName}
                maxLength={80}
                placeholderTextColor={C.muted}
              />
              <Text style={s.label}>Time zone</Text>
              <TextInput
                style={s.input}
                value={zone}
                onChangeText={setZone}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Africa/Kampala"
                placeholderTextColor={C.muted}
              />
              <View style={s.row}>
                <Pressable
                  style={s.ghost}
                  onPress={() => {
                    try {
                      setZone(Intl.DateTimeFormat().resolvedOptions().timeZone || zone);
                    } catch {
                      setProblem("This phone did not report a time zone.");
                    }
                  }}
                >
                  <Text style={s.ghostText}>Use this phone's time zone</Text>
                </Pressable>
                <Pressable
                  style={[s.btn, saving && { opacity: 0.5 }]}
                  disabled={saving}
                  onPress={saveProfile}
                >
                  <Text style={s.btnText}>Save</Text>
                </Pressable>
              </View>
              <Text style={s.meta}>
                Your time zone decides what counts as "today" for habits, runs, the calendar and
                quiet hours.
              </Text>
            </View>

            <Text style={[s.group, { marginTop: 6 }]}>Modules in {wsName}</Text>
            {!canManage && (
              <Text style={s.muted}>Only workspace owners and admins can change modules.</Text>
            )}
            {views.map((m) => (
              <View key={m.id} style={s.card}>
                <View style={s.top}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.title}>{m.name}</Text>
                    <Text style={s.meta}>{m.description}</Text>
                    {m.dependencies.length > 0 && (
                      <Text style={s.meta}>Requires: {m.dependencies.join(", ")}</Text>
                    )}
                    {m.core && <Text style={s.meta}>Core module, always on.</Text>}
                  </View>
                  {!m.available ? (
                    <Text style={s.meta}>Not available yet</Text>
                  ) : m.canToggle ? (
                    <Pressable
                      style={[s.ghost, toggling === m.id && { opacity: 0.5 }]}
                      disabled={toggling === m.id}
                      onPress={() => toggle(m.id, !m.enabled)}
                    >
                      <Text style={s.ghostText}>{m.enabled ? "Disable" : "Enable"}</Text>
                    </Pressable>
                  ) : (
                    <Text style={s.meta}>{m.enabled ? "Enabled" : "Disabled"}</Text>
                  )}
                </View>
              </View>
            ))}
            <Text style={s.muted}>
              Disabled modules disappear from search and the website sidebar; your data is kept. The
              Home grid here still lists every module.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  page: { padding: 16, paddingBottom: 32 },
  input: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
    marginBottom: 10,
    color: C.text,
  },
  label: { color: C.text, fontSize: 13, marginTop: 8 },
  btn: { backgroundColor: C.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  btnText: { color: "#fff", fontWeight: "700" },
  ghost: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  ghostText: { color: C.primary, fontWeight: "600", fontSize: 13 },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 },
  error: { color: C.danger, marginBottom: 8 },
  ok: { color: "#15803d", marginBottom: 8 },
  muted: { color: C.muted, marginVertical: 8, fontSize: 12 },
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
  top: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  title: { color: C.text, fontWeight: "700", fontSize: 15 },
  meta: { color: C.muted, fontSize: 12, marginTop: 4 },
});
