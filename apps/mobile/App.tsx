import { StatusBar } from "expo-status-bar";
import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { configured } from "./src/config";
import { dueLabel, isSafeLink, timeAgo } from "./src/format";
import { supabase } from "./src/supabase";

const C = {
  bg: "#faf8f4",
  card: "#ffffff",
  text: "#1c1917",
  muted: "#78716c",
  primary: "#8a6d1f",
  border: "#e7e2d8",
  danger: "#b91c1c",
};

type Tab = "notifications" | "tasks" | "account";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!configured) {
      setReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    // Token refresh only runs while the app is in the foreground.
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active") supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    return () => {
      sub.subscription.unsubscribe();
      app.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root}>
        <StatusBar style="dark" />
        {!configured ? (
          <Centered>
            <Text style={styles.title}>Not configured</Text>
            <Text style={styles.muted}>
              Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, then restart
              the app.
            </Text>
          </Centered>
        ) : !ready ? (
          <Centered>
            <ActivityIndicator />
          </Centered>
        ) : session ? (
          <Home session={session} />
        ) : (
          <SignIn />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    // Do not reveal whether the account exists.
    if (e) setError("Could not sign in. Check your email and password.");
    setBusy(false);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.centered}
    >
      <Text style={styles.brand}>KKINGG AI</Text>
      <Text style={[styles.muted, { marginBottom: 24 }]}>Sign in with your account.</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={submit}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable
        style={[styles.button, (busy || !email || !password) && styles.disabled]}
        disabled={busy || !email || !password}
        onPress={submit}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
      </Pressable>
      <Text style={[styles.muted, { marginTop: 16, textAlign: "center" }]}>
        New accounts are created on the website.
      </Text>
    </KeyboardAvoidingView>
  );
}

function Home({ session }: { session: Session }) {
  const [tab, setTab] = useState<Tab>("notifications");
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {tab === "notifications" && <Notifications />}
        {tab === "tasks" && <Tasks />}
        {tab === "account" && <Account session={session} />}
      </View>
      <View style={styles.tabs}>
        {(["notifications", "tasks", "account"] as const).map((t) => (
          <Pressable key={t} style={styles.tab} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabActive]}>
              {t === "notifications" ? "Notifications" : t === "tasks" ? "Tasks" : "Account"}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

type Notice = {
  id: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

function useLoader<T>(
  load: () => Promise<{ data: T[] | null; error: { message: string } | null }>,
) {
  const [items, setItems] = useState<T[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const run = useCallback(
    async (pull: boolean) => {
      if (pull) setRefreshing(true);
      const { data, error: e } = await load();
      if (e) setError("Could not load. Pull down to try again.");
      else {
        setError(null);
        setItems(data ?? []);
      }
      setLoading(false);
      setRefreshing(false);
    },
    [load],
  );

  useEffect(() => {
    void run(false);
  }, [run]);

  return { items, error, loading, refreshing, reload: () => run(true), setItems };
}

function Notifications() {
  const load = useCallback(
    async () =>
      await supabase
        .from("notifications")
        .select("id, title, body, link, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(100)
        .overrideTypes<Notice[]>(),
    [],
  );
  const { items, error, loading, refreshing, reload, setItems } = useLoader<Notice>(load);
  const [actionError, setActionError] = useState<string | null>(null);

  async function markRead(id: string) {
    setActionError(null);
    const stamp = new Date().toISOString();
    const { error: e } = await supabase
      .from("notifications")
      .update({ read_at: stamp })
      .eq("id", id);
    if (e) setActionError("Could not mark as read.");
    else setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: stamp } : n)));
  }

  if (loading)
    return (
      <Centered>
        <ActivityIndicator />
      </Centered>
    );
  return (
    <FlatList
      data={items}
      keyExtractor={(n) => n.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
      ListHeaderComponent={
        <View>
          <Text style={styles.title}>Notifications</Text>
          {(error || actionError) && <Text style={styles.error}>{error ?? actionError}</Text>}
        </View>
      }
      ListEmptyComponent={
        !error ? (
          <Text style={styles.muted}>
            Nothing yet. Alerts appear when something you track is coming up.
          </Text>
        ) : undefined
      }
      renderItem={({ item }) => (
        <View style={[styles.card, item.read_at && { opacity: 0.6 }]}>
          <Text style={[styles.cardTitle, !item.read_at && { fontWeight: "700" }]}>
            {item.title}
          </Text>
          {item.body ? <Text style={styles.muted}>{item.body}</Text> : null}
          <Text style={styles.small}>
            {timeAgo(item.created_at)}
            {isSafeLink(item.link) ? `  ·  ${item.link} on the website` : ""}
          </Text>
          {!item.read_at && (
            <Pressable onPress={() => markRead(item.id)} style={styles.link}>
              <Text style={styles.linkText}>Mark read</Text>
            </Pressable>
          )}
        </View>
      )}
    />
  );
}

type TaskRow = { id: string; title: string; status: string; due_at: string | null };

function Tasks() {
  const load = useCallback(
    async () =>
      await supabase
        .from("tasks")
        .select("id, title, status, due_at")
        .is("deleted_at", null)
        .in("status", ["todo", "in_progress"])
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(100)
        .overrideTypes<TaskRow[]>(),
    [],
  );
  const { items, error, loading, refreshing, reload } = useLoader<TaskRow>(load);

  if (loading)
    return (
      <Centered>
        <ActivityIndicator />
      </Centered>
    );
  return (
    <FlatList
      data={items}
      keyExtractor={(t) => t.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
      ListHeaderComponent={
        <View>
          <Text style={styles.title}>Open tasks</Text>
          <Text style={[styles.small, { marginBottom: 8 }]}>
            Read-only for now. Edit tasks on the website.
          </Text>
          {error && <Text style={styles.error}>{error}</Text>}
        </View>
      }
      ListEmptyComponent={!error ? <Text style={styles.muted}>No open tasks.</Text> : undefined}
      renderItem={({ item }) => {
        const due = dueLabel(item.due_at);
        return (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={[styles.small, due === "Overdue" && { color: C.danger }]}>
              {item.status === "in_progress" ? "In progress" : "To do"}
              {due ? `  ·  ${due}` : ""}
            </Text>
          </View>
        );
      }}
    />
  );
}

function Account({ session }: { session: Session }) {
  const [busy, setBusy] = useState(false);
  return (
    <View style={styles.list}>
      <Text style={styles.title}>Account</Text>
      <Text style={styles.muted}>Signed in as {session.user.email}</Text>
      <Pressable
        style={[styles.button, { marginTop: 24 }, busy && styles.disabled]}
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          await supabase.auth.signOut();
          setBusy(false);
        }}
      >
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  centered: { flex: 1, justifyContent: "center", padding: 24 },
  list: { padding: 16 },
  brand: { fontSize: 28, fontWeight: "800", color: C.primary, marginBottom: 4 },
  title: { fontSize: 22, fontWeight: "700", color: C.text, marginBottom: 12 },
  muted: { color: C.muted, fontSize: 14 },
  small: { color: C.muted, fontSize: 12, marginTop: 4 },
  error: { color: C.danger, marginBottom: 12 },
  input: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    color: C.text,
  },
  button: { backgroundColor: C.primary, borderRadius: 8, padding: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "700" },
  disabled: { opacity: 0.5 },
  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  cardTitle: { color: C.text, fontSize: 15 },
  link: { marginTop: 8, alignSelf: "flex-start" },
  linkText: { color: C.primary, fontWeight: "600" },
  tabs: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.card,
  },
  tab: { flex: 1, padding: 14, alignItems: "center" },
  tabText: { color: C.muted, fontSize: 13 },
  tabActive: { color: C.primary, fontWeight: "700" },
});
