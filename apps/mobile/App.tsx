import { StatusBar } from "expo-status-bar";
import type { Session } from "@supabase/supabase-js";
import type { ComponentType, Ref } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  FlatList,
  KeyboardAvoidingView,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { WebView, type WebViewProps } from "react-native-webview";
import type {
  ShouldStartLoadRequest,
  WebViewNavigation,
} from "react-native-webview/lib/WebViewTypes";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AcademicsScreen } from "./src/AcademicsScreen";
import { BusinessScreen } from "./src/BusinessScreen";
import { CalendarScreen } from "./src/CalendarScreen";
import { GoalsScreen } from "./src/GoalsScreen";
import { HabitsScreen } from "./src/HabitsScreen";
import { IdeasScreen } from "./src/IdeasScreen";
import { FlashcardsScreen } from "./src/FlashcardsScreen";
import { NewsScreen } from "./src/NewsScreen";
import { PersonalScreen } from "./src/PersonalScreen";
import { ProjectsScreen } from "./src/ProjectsScreen";
import { RunningScreen } from "./src/RunningScreen";
import { CareerScreen } from "./src/CareerScreen";
import { ChessScreen } from "./src/ChessScreen";
import { Dashboard } from "./src/Dashboard";
import { C } from "./src/theme";
import { BUILD_NUMBER, configured } from "./src/config";
import { cleanTitle, dueLabel, isSafeLink, timeAgo } from "./src/format";
import { supabase } from "./src/supabase";
import { isInternal, isOpenable, SITE_URL } from "./src/web";
import {
  currentBuild,
  decide,
  DOWNLOAD_URL,
  LATEST_URL,
  parseLatest,
  percent,
  sizeLabel,
  type UpdateState,
} from "./src/update";

// react-native-webview 14 types its class component for React 18; this restores the props and ref typing under React 19.
const SiteView = WebView as unknown as ComponentType<WebViewProps & { ref?: Ref<WebView> }>;

type Screen =
  | "calendar"
  | "habits"
  | "goals"
  | "career"
  | "academics"
  | "business"
  | "chess"
  | "ideas"
  | "running"
  | "flashcards"
  | "projects"
  | "personal"
  | "news"
  | null;
type Tab = "home" | "web" | "notifications" | "tasks" | "account";

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

const TAB_LABEL: Record<Tab, string> = {
  home: "Home",
  web: "Website",
  notifications: "Notifications",
  tasks: "Tasks",
  account: "Account",
};

function Home({ session }: { session: Session }) {
  const [tab, setTab] = useState<Tab>("home");
  const [webUrl, setWebUrl] = useState(SITE_URL);
  const [screen, setScreen] = useState<Screen>(null);
  const web = useRef<WebView>(null);
  const canGoBack = useRef(false);

  // Android back button: go back inside the website first.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (tab === "web" && canGoBack.current) {
        web.current?.goBack();
        return true;
      }
      if (tab === "home" && screen) {
        setScreen(null);
        return true;
      }
      if (tab !== "home") {
        setTab("home");
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [tab, screen]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {/* The website stays mounted so you keep your place when switching tabs. */}
        <View style={{ flex: 1, display: tab === "web" ? "flex" : "none" }}>
          <SiteView
            ref={web}
            source={{ uri: webUrl }}
            style={{ flex: 1, backgroundColor: C.bg }}
            onNavigationStateChange={(n: WebViewNavigation) => {
              canGoBack.current = n.canGoBack;
            }}
            onShouldStartLoadWithRequest={(req: ShouldStartLoadRequest) => {
              if (isInternal(req.url)) return true;
              if (isOpenable(req.url)) Linking.openURL(req.url);
              return false;
            }}
            setSupportMultipleWindows={false}
            allowsBackForwardNavigationGestures
            startInLoadingState
            renderLoading={() => (
              <View style={[styles.centered, { alignItems: "center" }]}>
                <ActivityIndicator color={C.primary} />
              </View>
            )}
          />
        </View>
        {tab === "home" && screen === "calendar" && (
          <CalendarScreen
            onBack={() => setScreen(null)}
            onOpenWeb={() => {
              setWebUrl(`${SITE_URL}/calendar`);
              setScreen(null);
              setTab("web");
            }}
          />
        )}
        {tab === "home" && screen === "habits" && (
          <HabitsScreen
            onBack={() => setScreen(null)}
            onOpenWeb={() => {
              setWebUrl(`${SITE_URL}/habits`);
              setScreen(null);
              setTab("web");
            }}
          />
        )}
        {tab === "home" && screen === "goals" && (
          <GoalsScreen
            onBack={() => setScreen(null)}
            onOpenWeb={() => {
              setWebUrl(`${SITE_URL}/goals`);
              setScreen(null);
              setTab("web");
            }}
          />
        )}
        {tab === "home" && screen === "career" && (
          <CareerScreen
            onBack={() => setScreen(null)}
            onOpenWeb={() => {
              setWebUrl(`${SITE_URL}/career`);
              setScreen(null);
              setTab("web");
            }}
          />
        )}
        {tab === "home" && screen === "academics" && (
          <AcademicsScreen
            onBack={() => setScreen(null)}
            onOpenWeb={() => {
              setWebUrl(`${SITE_URL}/academics`);
              setScreen(null);
              setTab("web");
            }}
          />
        )}
        {tab === "home" && screen === "business" && (
          <BusinessScreen
            onBack={() => setScreen(null)}
            onOpenWeb={() => {
              setWebUrl(`${SITE_URL}/business`);
              setScreen(null);
              setTab("web");
            }}
          />
        )}
        {tab === "home" && screen === "chess" && (
          <ChessScreen
            onBack={() => setScreen(null)}
            onOpenWeb={() => {
              setWebUrl(`${SITE_URL}/chess`);
              setScreen(null);
              setTab("web");
            }}
          />
        )}
        {tab === "home" && screen === "ideas" && (
          <IdeasScreen
            onBack={() => setScreen(null)}
            onOpenWeb={() => {
              setWebUrl(`${SITE_URL}/ideas`);
              setScreen(null);
              setTab("web");
            }}
          />
        )}
        {tab === "home" && screen === "running" && (
          <RunningScreen
            onBack={() => setScreen(null)}
            onOpenWeb={() => {
              setWebUrl(`${SITE_URL}/running`);
              setScreen(null);
              setTab("web");
            }}
          />
        )}
        {tab === "home" && screen === "flashcards" && (
          <FlashcardsScreen
            onBack={() => setScreen(null)}
            onOpenWeb={() => {
              setWebUrl(`${SITE_URL}/flashcards`);
              setScreen(null);
              setTab("web");
            }}
          />
        )}
        {tab === "home" && screen === "projects" && (
          <ProjectsScreen
            onBack={() => setScreen(null)}
            onOpenWeb={() => {
              setWebUrl(`${SITE_URL}/projects`);
              setScreen(null);
              setTab("web");
            }}
          />
        )}
        {tab === "home" && screen === "personal" && (
          <PersonalScreen
            onBack={() => setScreen(null)}
            onOpenWeb={() => {
              setWebUrl(`${SITE_URL}/personal`);
              setScreen(null);
              setTab("web");
            }}
          />
        )}
        {tab === "home" && screen === "news" && (
          <NewsScreen
            onBack={() => setScreen(null)}
            onOpenWeb={() => {
              setWebUrl(`${SITE_URL}/news`);
              setScreen(null);
              setTab("web");
            }}
          />
        )}
        {tab === "home" && !screen && (
          <Dashboard
            onTab={setTab}
            onOpen={(path) => {
              if (path === "/calendar") return setScreen("calendar");
              if (path === "/habits") return setScreen("habits");
              if (path === "/goals") return setScreen("goals");
              if (path === "/career") return setScreen("career");
              if (path === "/academics") return setScreen("academics");
              if (path === "/business") return setScreen("business");
              if (path === "/chess") return setScreen("chess");
              if (path === "/ideas") return setScreen("ideas");
              if (path === "/running") return setScreen("running");
              if (path === "/flashcards") return setScreen("flashcards");
              if (path === "/projects") return setScreen("projects");
              if (path === "/personal") return setScreen("personal");
              if (path === "/news") return setScreen("news");
              setWebUrl(`${SITE_URL}${path}`);
              setTab("web");
            }}
          />
        )}
        {tab === "notifications" && <Notifications />}
        {tab === "tasks" && <Tasks />}
        {tab === "account" && <Account session={session} />}
      </View>
      <View style={styles.tabs}>
        {(["home", "tasks", "notifications", "web", "account"] as const).map((t) => (
          <Pressable key={t} style={styles.tab} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabActive]}>{TAB_LABEL[t]}</Text>
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

type TaskRow = {
  id: string;
  title: string;
  status: string;
  due_at: string | null;
  revision: number;
  recurrence_rule: string | null;
};

function Tasks() {
  const load = useCallback(
    async () =>
      await supabase
        .from("tasks")
        .select("id, title, status, due_at, revision, recurrence_rule")
        .is("deleted_at", null)
        .in("status", ["todo", "in_progress"])
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(100)
        .overrideTypes<TaskRow[]>(),
    [],
  );
  const { items, error, loading, refreshing, reload } = useLoader<TaskRow>(load);
  const [title, setTitle] = useState("");
  const [working, setWorking] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  async function add() {
    const clean = cleanTitle(title);
    if (!clean || working) return;
    setWorking("add");
    setProblem(null);
    // New tasks go to the user's first (personal) workspace, the same default the website uses.
    const { data: ws, error: wsErr } = await supabase
      .from("workspaces")
      .select("id")
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (wsErr || !ws) {
      setProblem("Could not find your workspace.");
      setWorking(null);
      return;
    }
    const { error: insErr } = await supabase
      .from("tasks")
      .insert({ workspace_id: ws.id, title: clean });
    setWorking(null);
    if (insErr) return setProblem("Could not add the task. Check your connection and try again.");
    setTitle("");
    reload();
  }

  async function complete(t: TaskRow) {
    if (working) return;
    setWorking(t.id);
    setProblem(null);
    const { error: rpcErr } = await supabase.rpc("complete_task", {
      task_id: t.id,
      expected_revision: t.revision,
    });
    setWorking(null);
    if (rpcErr) {
      setProblem(
        rpcErr.message.includes("changed elsewhere")
          ? "That task was changed elsewhere. The list has been refreshed."
          : "Could not complete the task.",
      );
    }
    reload();
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
      keyExtractor={(t) => t.id}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
      ListHeaderComponent={
        <View>
          <Text style={styles.title}>Open tasks</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Add a task"
              placeholderTextColor={C.muted}
              value={title}
              onChangeText={setTitle}
              maxLength={300}
              returnKeyType="done"
              onSubmitEditing={add}
            />
            <Pressable
              style={[
                styles.button,
                { paddingHorizontal: 16 },
                (!cleanTitle(title) || !!working) && styles.disabled,
              ]}
              disabled={!cleanTitle(title) || !!working}
              onPress={add}
              accessibilityLabel="Add task"
            >
              <Text style={styles.buttonText}>Add</Text>
            </Pressable>
          </View>
          <Text style={[styles.small, { marginBottom: 8 }]}>
            Tap the circle to complete a task. Edit details and repeating tasks in the Website tab.
          </Text>
          {(error || problem) && <Text style={styles.error}>{problem ?? error}</Text>}
        </View>
      }
      ListEmptyComponent={!error ? <Text style={styles.muted}>No open tasks.</Text> : undefined}
      renderItem={({ item }) => {
        const due = dueLabel(item.due_at);
        const repeats = !!item.recurrence_rule;
        return (
          <View style={[styles.card, { flexDirection: "row", alignItems: "center", gap: 12 }]}>
            <Pressable
              onPress={() => complete(item)}
              disabled={repeats || !!working}
              accessibilityLabel={
                repeats ? "Repeating task: complete on the website" : `Complete ${item.title}`
              }
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                borderWidth: 2,
                borderColor: repeats ? C.border : C.primary,
                opacity: working === item.id ? 0.4 : 1,
              }}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={[styles.small, due === "Overdue" && { color: C.danger }]}>
                {item.status === "in_progress" ? "In progress" : "To do"}
                {due ? `  ·  ${due}` : ""}
                {repeats ? "  ·  Repeats" : ""}
              </Text>
            </View>
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
      <Updates />
    </View>
  );
}

/** Settings: check for a newer build, download it inside the app and hand it to Android's installer (one confirmation tap; data is kept). */
function Updates() {
  const [phase, setPhase] = useState<"idle" | "checking" | "downloading" | "ready">("idle");
  const [state, setState] = useState<UpdateState | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const build = currentBuild(BUILD_NUMBER);

  async function check() {
    setPhase("checking");
    setError(null);
    try {
      const res = await fetch(LATEST_URL);
      if (!res.ok) throw new Error("check");
      setState(decide(build, parseLatest(await res.json())));
    } catch {
      setState(null);
      setError("Could not check for updates. Try again.");
    } finally {
      setPhase("idle");
    }
  }

  async function install() {
    try {
      const FS = await import("expo-file-system/legacy");
      const Launcher = await import("expo-intent-launcher");
      const target = `${FS.cacheDirectory}kkingg-update.apk`;
      await FS.deleteAsync(target, { idempotent: true });
      setPhase("downloading");
      setProgress(0);
      setError(null);
      const task = FS.createDownloadResumable(DOWNLOAD_URL, target, {}, (p) =>
        setProgress(percent(p.totalBytesWritten, p.totalBytesExpectedToWrite)),
      );
      const done = await task.downloadAsync();
      if (!done || done.status !== 200) throw new Error("download");
      setPhase("ready");
      await Launcher.startActivityAsync("android.intent.action.VIEW", {
        data: await FS.getContentUriAsync(target),
        flags: 1,
        type: "application/vnd.android.package-archive",
      });
    } catch {
      setError("The update could not be installed. Check your connection and try again.");
      setPhase("idle");
    }
  }

  const busy = phase === "checking" || phase === "downloading";
  return (
    <View style={{ marginTop: 32 }}>
      <Text style={styles.title}>App updates</Text>
      <Text style={styles.muted}>{build > 0 ? `Version build ${build}` : "Development build"}</Text>
      <Pressable
        style={[styles.button, { marginTop: 12 }, busy && styles.disabled]}
        disabled={busy}
        onPress={check}
      >
        <Text style={styles.buttonText}>
          {phase === "checking" ? "Checking…" : "Check for updates"}
        </Text>
      </Pressable>
      {error && <Text style={[styles.error, { marginTop: 8 }]}>{error}</Text>}
      {state?.kind === "current" && (
        <Text style={[styles.muted, { marginTop: 8 }]}>You are up to date.</Text>
      )}
      {state?.kind === "unknown" && (
        <Text style={[styles.muted, { marginTop: 8 }]}>No update is available right now.</Text>
      )}
      {state?.kind === "available" && (
        <View style={{ marginTop: 8 }}>
          <Text style={styles.muted}>
            A new version is available{sizeLabel(state.size) ? ` (${sizeLabel(state.size)})` : ""}.
          </Text>
          <Pressable
            style={[styles.button, { marginTop: 8 }, busy && styles.disabled]}
            disabled={busy}
            onPress={install}
          >
            <Text style={styles.buttonText}>
              {phase === "downloading" ? `Downloading… ${progress}%` : "Update now"}
            </Text>
          </Pressable>
          {phase === "ready" && (
            <Text style={styles.small}>
              Confirm on the next screen to finish. If Android asks, allow this app to install
              updates. Your data is kept.
            </Text>
          )}
        </View>
      )}
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
