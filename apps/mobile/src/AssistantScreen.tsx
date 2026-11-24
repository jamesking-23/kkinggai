import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
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
import { ScreenHeader } from "./ScreenHeader";
import { supabase } from "./supabase";
import { C } from "./theme";
import { SITE_URL } from "./web";

/** Native assistant chat. Replies come from the site's /api/assistant (the AI provider key stays on the server). The assistant only sees the conversation, not your other data. Daily limit applies, as on the website. */
export function AssistantScreen({ onBack }: { onBack: () => void }) {
  const [convs, setConvs] = useState<ConversationRow[] | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [chatting, setChatting] = useState(false);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const scroller = useRef<{ scrollToEnd: (o?: { animated?: boolean }) => void } | null>(null);

  const loadList = useCallback(async () => {
    setFailed(false);
    const r = await supabase
      .from("ai_conversations")
      .select("id, title, updated_at")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(30)
      .overrideTypes<ConversationRow[], { merge: false }>();
    if (r.error) return setFailed(true);
    setConvs(r.data ?? []);
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
    loadList();
  }, [loadList]);

  async function open(id: string | null) {
    setProblem(null);
    setCurrent(id);
    setMessages([]);
    setChatting(true);
    if (id) await loadMessages(id);
  }

  function leave() {
    setChatting(false);
    setCurrent(null);
    setMessages([]);
    setProblem(null);
    loadList();
  }

  async function send() {
    if (sending) return;
    const v = checkMessage(text);
    if (typeof v === "string") return setProblem(v);
    setSending(true);
    setProblem(null);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setSending(false);
      return setProblem("Your session expired. Sign in again.");
    }
    // Show the user's message at once; it is replaced by the stored copy after the reply.
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
    } catch {
      setMessages((m) => m.filter((x) => x.id !== pending.id));
      setText(v.message);
      setProblem("Could not reach the assistant. Check your connection and try again.");
    } finally {
      clearTimeout(timer);
      setSending(false);
    }
  }

  async function remove(id: string) {
    const { error } = await supabase
      .from("ai_conversations")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return setProblem("Could not delete the conversation.");
    leave();
  }

  if (chatting) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScreenHeader
          title="Assistant"
          onBack={leave}
          action={current ? { label: "Delete", onPress: () => remove(current) } : undefined}
        />
        <ScrollView
          ref={scroller as never}
          contentContainerStyle={s.page}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 && !sending && (
            <Text style={s.muted}>
              Ask anything. The assistant only sees this conversation, not your tasks, goals or
              vault.
            </Text>
          )}
          {messages.map((m) => (
            <View key={m.id} style={[s.bubble, m.role === "user" ? s.mine : s.theirs]}>
              <Text style={m.role === "user" ? s.mineText : s.theirsText} selectable>
                {m.content}
              </Text>
            </View>
          ))}
          {sending && <ActivityIndicator color={C.primary} style={{ marginTop: 8 }} />}
          {problem && <Text style={s.error}>{problem}</Text>}
        </ScrollView>
        <View style={s.composer}>
          <TextInput
            style={s.input}
            placeholder="Message"
            placeholderTextColor={C.muted}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={MAX_MESSAGE_CHARS}
            editable={!sending}
          />
          <Pressable
            style={[s.send, (sending || !text.trim()) && { opacity: 0.5 }]}
            disabled={sending || !text.trim()}
            onPress={send}
          >
            <Text style={s.sendText}>Send</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Assistant" onBack={onBack} />
      <ScrollView
        contentContainerStyle={s.page}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await loadList();
              setRefreshing(false);
            }}
          />
        }
      >
        <Pressable style={s.addBtn} onPress={() => open(null)}>
          <Text style={s.sendText}>+ New chat</Text>
        </Pressable>
        {failed && <Text style={s.error}>Could not load chats. Pull down to retry.</Text>}
        {convs === null && !failed && <ActivityIndicator color={C.primary} />}
        {convs && convs.length === 0 && <Text style={s.muted}>No chats yet.</Text>}
        {convs?.map((c) => (
          <Pressable key={c.id} style={s.card} onPress={() => open(c.id)}>
            <Text style={s.title} numberOfLines={2}>
              {conversationTitle(c)}
            </Text>
            <Text style={s.meta}>{c.updated_at.slice(0, 10)}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  page: { padding: 16, paddingBottom: 24 },
  addBtn: {
    backgroundColor: C.primary,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginBottom: 12,
  },
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
  muted: { color: C.muted, marginVertical: 8 },
  error: { color: C.danger, marginTop: 10 },
  bubble: { maxWidth: "88%", borderRadius: 14, padding: 12, marginBottom: 8 },
  mine: { alignSelf: "flex-end", backgroundColor: C.primary },
  theirs: {
    alignSelf: "flex-start",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  mineText: { color: "#fff", lineHeight: 20 },
  theirsText: { color: C.text, lineHeight: 20 },
  composer: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-end",
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.bg,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: C.text,
  },
  send: {
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sendText: { color: "#fff", fontWeight: "700" },
});
