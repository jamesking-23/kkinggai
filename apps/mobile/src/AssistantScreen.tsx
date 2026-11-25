import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  checkMessage,
  conversationTitle,
  MAX_MESSAGE_CHARS,
  parseReply,
  requestBody,
  visibleMessages,
  type ConversationRow,
  type MessageRow,
} from "./assistant";
import {
  blocks,
  COMMANDS,
  firstName,
  STARTERS,
  type Block,
  type Span,
  type Starter,
} from "./assistantFormat";
import { supabase } from "./supabase";
import { useKeyboardOverlap, type Measurable } from "./useKeyboardOverlap";
import { SITE_URL } from "./web";

// The assistant is a dark, full-screen experience of its own, so it has its own palette.
const D = {
  bg: "#0a0a10",
  surface: "#1b1b22",
  surface2: "#26262f",
  border: "#2e2e3a",
  text: "#f3f3f7",
  muted: "#9b9bab",
  accent: "#3d55d6",
  glow: "#1a2a78",
  danger: "#ff7b7b",
};

/** Native assistant. Commands run on the server's local model; open questions may use a stored answer or the online AI. The assistant never sees your vault or other data beyond what a command reads. */
export function AssistantScreen({ onBack }: { onBack: () => void }) {
  const [convs, setConvs] = useState<ConversationRow[] | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [name, setName] = useState("there");
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const scroller = useRef<{ scrollToEnd: (o?: { animated?: boolean }) => void } | null>(null);
  const input = useRef<{ focus: () => void } | null>(null);
  const root = useRef<Measurable | null>(null);
  const { overlap, onLayout } = useKeyboardOverlap(root);

  const loadList = useCallback(async () => {
    const r = await supabase
      .from("ai_conversations")
      .select("id, title, updated_at")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(30)
      .overrideTypes<ConversationRow[], { merge: false }>();
    if (!r.error) setConvs(r.data ?? []);
  }, []);

  const loadMessages = useCallback(async (id: string) => {
    const r = await supabase
      .from("ai_messages")
      .select("id, role, content")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true })
      .limit(200)
      .overrideTypes<MessageRow[], { merge: false }>();
    if (r.error) return setProblem("Could not load the conversation.");
    setMessages(visibleMessages(r.data ?? []));
  }, []);

  useEffect(() => {
    void loadList();
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const p = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", data.user.id)
        .maybeSingle();
      setName(firstName(p.data?.display_name));
    })();
  }, [loadList]);

  function newChat() {
    setCurrent(null);
    setMessages([]);
    setProblem(null);
    setDrawer(false);
    setText("");
  }

  async function openChat(id: string) {
    setDrawer(false);
    setProblem(null);
    setCurrent(id);
    setMessages([]);
    await loadMessages(id);
  }

  async function send(raw: string) {
    if (sending) return;
    const v = checkMessage(raw);
    if (typeof v === "string") return setProblem(v);
    setSending(true);
    setProblem(null);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setSending(false);
      return setProblem("Your session expired. Sign in again.");
    }
    // Show the message at once; it is replaced by the stored copy after the reply.
    const pending: MessageRow = { id: `pending-${Date.now()}`, role: "user", content: v.message };
    setMessages((m) => [...m, pending]);
    setText("");
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 70_000);
    try {
      const res = await fetch(`${SITE_URL}/api/assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: requestBody(v.message, current),
        signal: ctl.signal,
      });
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      const r = parseReply(res.status, body);
      const cid = r.conversationId ?? current;
      if (cid) {
        setCurrent(cid);
        await loadMessages(cid);
      }
      if (!r.ok) {
        setProblem(r.error);
        if (!cid) {
          setMessages((m) => m.filter((x) => x.id !== pending.id));
          setText(v.message);
        }
      }
      void loadList();
    } catch {
      setMessages((m) => m.filter((x) => x.id !== pending.id));
      setText(v.message);
      setProblem("Could not reach the assistant. Check your connection and try again.");
    } finally {
      clearTimeout(timer);
      setSending(false);
    }
  }

  function pick(s: Starter) {
    setMenu(false);
    if (s.send) void send(s.send);
    else {
      setText(s.fill ?? "");
      setTimeout(() => input.current?.focus(), 80);
    }
  }

  function confirmDelete(c: ConversationRow) {
    Alert.alert("Delete this chat?", conversationTitle(c), [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase
            .from("ai_conversations")
            .update({ deleted_at: new Date().toISOString() })
            .eq("id", c.id);
          if (error) return setProblem("Could not delete the chat.");
          if (c.id === current) newChat();
          void loadList();
        },
      },
    ]);
  }

  const empty = messages.length === 0 && !sending;
  const canSend = !sending && text.trim().length > 0;

  return (
    <View
      ref={root as never}
      collapsable={false}
      onLayout={onLayout}
      style={[s.root, { paddingBottom: overlap }]}
    >
      <Glow />
      <View style={s.header}>
        <View style={s.row}>
          <Pressable
            style={s.iconBtn}
            onPress={onBack}
            hitSlop={8}
            accessibilityLabel="Back to Home"
          >
            <Text style={s.iconText}>‹</Text>
          </Pressable>
          <Pressable
            style={s.iconBtn}
            onPress={() => {
              void loadList();
              setDrawer(true);
            }}
            hitSlop={8}
            accessibilityLabel="Chat history"
          >
            <Text style={s.iconText}>☰</Text>
          </Pressable>
        </View>
        <Text style={s.headTitle}>Assistant</Text>
        <Pressable style={s.iconBtn} onPress={newChat} hitSlop={8} accessibilityLabel="New chat">
          <Text style={s.iconText}>✎</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scroller as never}
        style={{ flex: 1 }}
        contentContainerStyle={[s.page, empty && { flexGrow: 1 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onContentSizeChange={() => !empty && scroller.current?.scrollToEnd({ animated: true })}
        refreshControl={
          current ? (
            <RefreshControl
              tintColor="#fff"
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await loadMessages(current);
                setRefreshing(false);
              }}
            />
          ) : undefined
        }
      >
        {empty ? (
          <View style={s.hero}>
            <Mark size={56} />
            <Text style={s.greeting}>Hi {name}, what&apos;s on your mind?</Text>
            <View style={s.starters}>
              {STARTERS.map((st) => (
                <Pressable key={st.label} style={s.starter} onPress={() => pick(st)}>
                  <View style={s.starterIcon}>
                    <Text style={s.starterGlyph}>{st.icon}</Text>
                  </View>
                  <Text style={s.starterText}>{st.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          messages.map((m) =>
            m.role === "user" ? (
              <View key={m.id} style={s.mine}>
                <Text style={s.mineText} selectable>
                  {m.content}
                </Text>
              </View>
            ) : (
              <View key={m.id} style={s.theirs}>
                <Mark size={22} />
                <View style={{ flex: 1 }}>
                  <Markdown source={m.content} />
                </View>
              </View>
            ),
          )
        )}
        {sending && (
          <View style={s.theirs}>
            <Mark size={22} />
            <Dots />
          </View>
        )}
        {problem && <Text style={s.error}>{problem}</Text>}
      </ScrollView>

      <View style={s.composerWrap}>
        <View style={s.composer}>
          <Pressable
            style={s.plus}
            onPress={() => setMenu(true)}
            hitSlop={6}
            accessibilityLabel="Commands"
          >
            <Text style={s.plusText}>+</Text>
          </Pressable>
          <TextInput
            ref={input as never}
            style={s.input}
            placeholder="Ask or type a command"
            placeholderTextColor={D.muted}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={MAX_MESSAGE_CHARS}
            editable={!sending}
            selectionColor={D.accent}
            cursorColor={D.accent}
          />
          <Pressable
            style={[s.send, !canSend && s.sendOff]}
            disabled={!canSend}
            onPress={() => void send(text)}
            accessibilityLabel="Send"
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={s.sendText}>↑</Text>
            )}
          </Pressable>
        </View>
      </View>

      <Modal
        visible={drawer}
        transparent
        animationType="fade"
        onRequestClose={() => setDrawer(false)}
      >
        <View style={s.modalRoot}>
          <View style={s.drawer}>
            <Text style={s.drawerTitle}>Chats</Text>
            <Pressable style={s.newChat} onPress={newChat}>
              <Text style={s.newChatText}>✎ New chat</Text>
            </Pressable>
            <ScrollView>
              {convs === null && <ActivityIndicator color="#fff" style={{ marginTop: 16 }} />}
              {convs?.length === 0 && <Text style={s.muted}>No chats yet.</Text>}
              {convs?.map((c) => (
                <Pressable
                  key={c.id}
                  style={[s.convRow, c.id === current && { backgroundColor: D.surface2 }]}
                  onPress={() => void openChat(c.id)}
                  onLongPress={() => confirmDelete(c)}
                >
                  <Text style={s.convTitle} numberOfLines={1}>
                    {conversationTitle(c)}
                  </Text>
                </Pressable>
              ))}
              {!!convs?.length && <Text style={s.hint}>Press and hold a chat to delete it.</Text>}
            </ScrollView>
          </View>
          <Pressable style={s.backdrop} onPress={() => setDrawer(false)} />
        </View>
      </Modal>

      <Modal visible={menu} transparent animationType="slide" onRequestClose={() => setMenu(false)}>
        <Pressable style={s.sheetBackdrop} onPress={() => setMenu(false)}>
          <Pressable style={s.sheet} onPress={() => undefined}>
            <Text style={s.drawerTitle}>Commands</Text>
            <ScrollView>
              {COMMANDS.map((c) => (
                <Pressable key={c.label} style={s.cmd} onPress={() => pick(c)}>
                  <View style={s.starterIcon}>
                    <Text style={s.starterGlyph}>{c.icon}</Text>
                  </View>
                  <Text style={s.starterText}>{c.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/** The assistant's mark: an original glyph in a soft ring. */
function Mark({ size }: { size: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: D.glow,
        borderWidth: Math.max(1, size / 22),
        borderColor: D.accent,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: D.text, fontWeight: "800", fontSize: size * 0.46 }}>K</Text>
    </View>
  );
}

/** A deep-blue glow rising from the bottom, built from stacked bands so it needs no extra native module. */
function Glow() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: 14 }, (_, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: `${(i + 1) * 3.2}%`,
            backgroundColor: D.glow,
            opacity: 0.045,
          }}
        />
      ))}
    </View>
  );
}

function Dots() {
  const vals = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;
  useEffect(() => {
    const loops = vals.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(v, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.3, duration: 320, useNativeDriver: true }),
          Animated.delay(320 - i * 160),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [vals]);
  return (
    <View
      style={{ flexDirection: "row", gap: 6, paddingVertical: 8 }}
      accessibilityLabel="Thinking"
    >
      {vals.map((v, i) => (
        <Animated.View key={i} style={[s.dot, { opacity: v }]} />
      ))}
    </View>
  );
}

function Spans({ spans }: { spans: Span[] }) {
  return (
    <>
      {spans.map((sp, i) => (
        <Text
          key={i}
          style={[
            sp.bold && { fontWeight: "700" },
            sp.italic && { fontStyle: "italic" },
            sp.code && s.inlineCode,
          ]}
        >
          {sp.text}
        </Text>
      ))}
    </>
  );
}

function Markdown({ source }: { source: string }) {
  const list: Block[] = blocks(source);
  return (
    <View style={{ gap: 8 }}>
      {list.map((b, i) => {
        if (b.type === "code")
          return (
            <View key={i} style={s.codeBlock}>
              <Text style={s.codeText} selectable>
                {b.text}
              </Text>
            </View>
          );
        if (b.type === "li")
          return (
            <View key={i} style={{ flexDirection: "row", gap: 8 }}>
              <Text style={s.replyText}>{b.marker}</Text>
              <Text style={[s.replyText, { flex: 1 }]} selectable>
                <Spans spans={b.spans} />
              </Text>
            </View>
          );
        return (
          <Text key={i} style={b.type === "h" ? s.replyHead : s.replyText} selectable>
            <Spans spans={b.spans} />
          </Text>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: D.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  row: { flexDirection: "row", gap: 4 },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  iconText: { color: D.text, fontSize: 24 },
  headTitle: { color: D.text, fontSize: 17, fontWeight: "600" },
  page: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 18, gap: 18 },
  hero: { flex: 1, justifyContent: "space-between", paddingTop: 70 },
  greeting: {
    color: D.text,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "400",
    marginTop: 22,
    marginBottom: "auto",
  },
  starters: { gap: 6, paddingTop: 30 },
  starter: { flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 14 },
  cmd: { flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 12 },
  starterIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: D.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  starterGlyph: { color: D.text, fontSize: 17 },
  starterText: { color: D.text, fontSize: 17, flexShrink: 1 },
  mine: {
    alignSelf: "flex-end",
    maxWidth: "84%",
    backgroundColor: D.surface2,
    borderRadius: 22,
    borderBottomRightRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  mineText: { color: D.text, fontSize: 16, lineHeight: 23 },
  theirs: { flexDirection: "row", gap: 12, alignItems: "flex-start", paddingRight: 8 },
  replyText: { color: D.text, fontSize: 16, lineHeight: 24 },
  replyHead: { color: D.text, fontSize: 18, lineHeight: 26, fontWeight: "700", marginTop: 4 },
  inlineCode: { fontFamily: "monospace", backgroundColor: D.surface2, color: "#cfd6ff" },
  codeBlock: { backgroundColor: D.surface, borderRadius: 12, padding: 12 },
  codeText: { color: "#cfd6ff", fontFamily: "monospace", fontSize: 13, lineHeight: 19 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: D.muted },
  error: { color: D.danger, fontSize: 14 },
  composerWrap: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 12 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    backgroundColor: D.surface,
    borderRadius: 30,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: D.border,
  },
  plus: { width: 40, height: 44, alignItems: "center", justifyContent: "center" },
  plusText: { color: D.text, fontSize: 30, lineHeight: 32 },
  input: {
    flex: 1,
    maxHeight: 150,
    minHeight: 44,
    color: D.text,
    fontSize: 17,
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 4,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: D.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendOff: { backgroundColor: D.surface2, opacity: 0.7 },
  sendText: { color: "#fff", fontSize: 22, fontWeight: "700" },
  modalRoot: { flex: 1, flexDirection: "row" },
  drawer: {
    width: "82%",
    backgroundColor: D.bg,
    paddingTop: 48,
    paddingHorizontal: 14,
    borderRightWidth: 1,
    borderRightColor: D.border,
  },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  drawerTitle: { color: D.text, fontSize: 20, fontWeight: "700", marginBottom: 12 },
  newChat: {
    backgroundColor: D.surface,
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  newChatText: { color: D.text, fontSize: 15, fontWeight: "600" },
  convRow: { paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12 },
  convTitle: { color: D.text, fontSize: 15 },
  muted: { color: D.muted, marginTop: 12 },
  hint: { color: D.muted, fontSize: 12, marginTop: 14, textAlign: "center" },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: D.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
    maxHeight: "75%",
    borderWidth: 1,
    borderColor: D.border,
  },
});
