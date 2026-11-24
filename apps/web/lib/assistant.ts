import type { SupabaseClient } from "@supabase/supabase-js";
import { AiError, trimHistory, type ChatMessage, type ChatProvider } from "@kkingg/ai";
import { ASSISTANT_DAILY_MESSAGE_LIMIT, assistantMessageSchema } from "@kkingg/schemas";
import type { Database } from "./supabase/database.types";

export const HISTORY_CHAR_BUDGET = 24_000;
export const MAX_OUTPUT_TOKENS = 1024;

export const SYSTEM_PROMPT =
  "You are the assistant inside KKINGG AI, a private personal operating system. " +
  "Be concise and practical. You can only see this conversation: you cannot read the user's tasks, goals, " +
  "vault or other data, and you must not claim to have done anything outside this chat.";

export type AssistantResult =
  | { ok: true; conversationId: string; reply: string }
  | { ok: false; error: string; conversationId: string | null };

/**
 * One assistant turn, shared by the website and the phone app. Always runs on the server with the caller's own
 * Supabase client, so row-level security applies, and the AI provider key never leaves the server.
 * The user's message is stored first so it is never lost if the provider fails.
 */
export async function runAssistantTurn(
  supabase: SupabaseClient<Database>,
  provider: ChatProvider,
  workspaceId: string,
  input: { message?: unknown; conversationId?: unknown },
  now: Date = new Date(),
): Promise<AssistantResult> {
  const parsed = assistantMessageSchema.safeParse({
    message: input.message,
    conversationId: input.conversationId,
  });
  const rawId =
    typeof input.conversationId === "string" && input.conversationId ? input.conversationId : null;
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid message",
      conversationId: rawId,
    };
  const { message } = parsed.data;
  let conversationId = parsed.data.conversationId ?? null;

  // Cost control: signups are open, so cap how much one account can spend per day.
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("ai_messages")
    .select("id", { count: "exact", head: true })
    .eq("role", "user")
    .gte("created_at", since);
  if ((count ?? 0) >= ASSISTANT_DAILY_MESSAGE_LIMIT)
    return {
      ok: false,
      error: `Daily limit of ${ASSISTANT_DAILY_MESSAGE_LIMIT} messages reached. Try again tomorrow.`,
      conversationId,
    };

  let history: ChatMessage[] = [];
  if (conversationId) {
    const { data: conv } = await supabase
      .from("ai_conversations")
      .select("id")
      .eq("id", conversationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!conv)
      return { ok: false, error: "That conversation no longer exists.", conversationId: null };
    const { data: prior } = await supabase
      .from("ai_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(200);
    history = (prior ?? []).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));
  } else {
    const { data: created, error } = await supabase
      .from("ai_conversations")
      .insert({ workspace_id: workspaceId, title: message.slice(0, 60) })
      .select("id")
      .single();
    if (error || !created)
      return { ok: false, error: "Could not start a conversation.", conversationId: null };
    conversationId = created.id;
  }
  const id = conversationId as string;

  const { error: userErr } = await supabase
    .from("ai_messages")
    .insert({ conversation_id: id, role: "user", content: message });
  if (userErr) return { ok: false, error: "Could not save your message.", conversationId: id };

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...trimHistory([...history, { role: "user", content: message }], HISTORY_CHAR_BUDGET),
  ];

  let reply;
  try {
    reply = await provider.complete(messages, { maxOutputTokens: MAX_OUTPUT_TOKENS });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof AiError ? e.message : "The assistant failed unexpectedly.",
      conversationId: id,
    };
  }

  const { error: saveErr } = await supabase.from("ai_messages").insert({
    conversation_id: id,
    role: "assistant",
    content: reply.text.slice(0, 60000),
    provider: reply.provider,
    model: reply.model,
    input_tokens: reply.usage.inputTokens ?? null,
    output_tokens: reply.usage.outputTokens ?? null,
  });
  if (saveErr)
    return {
      ok: false,
      error: "The reply was generated but could not be saved.",
      conversationId: id,
    };

  // Touch the conversation so it sorts first (the revision trigger refreshes updated_at).
  await supabase.from("ai_conversations").update({ title: undefined }).eq("id", id);
  return { ok: true, conversationId: id, reply: reply.text };
}

/** The token from an `Authorization: Bearer <token>` header, or null. */
export function bearerToken(header: string | null | undefined): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec((header ?? "").trim());
  return m?.[1] ?? null;
}
