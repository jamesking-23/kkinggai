import type { SupabaseClient } from "@supabase/supabase-js";
import { AiError, trimHistory, type ChatMessage, type ChatProvider } from "@kkingg/ai";
import type { Assistant, AssistantData } from "@kkingg/assistant";
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

export type AssistantDeps = {
  /** The offline intent router. Always runs first. */
  assistant: Pick<Assistant, "reply">;
  data: AssistantData;
  timeZone: string;
  /** Optional cloud chat for messages the router does not understand. Null (the default) means fully offline. */
  provider?: ChatProvider | null;
  now?: Date;
};

export const OFFLINE_PROVIDER = "offline-router";

/**
 * One assistant turn, shared by the website and the phone app. Always runs on the server with the caller's own
 * Supabase client, so row-level security applies.
 * The message goes to the offline intent router first: it picks a deterministic action and runs it, with no AI
 * model involved. Only when the router does not recognise the message AND a cloud provider was passed in (which
 * the callers do only when a key is set and ASSISTANT_CLOUD_FALLBACK=1) is the message sent to that provider.
 * The user's message is stored first so it is never lost if anything fails.
 */
export async function runAssistantTurn(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  input: { message?: unknown; conversationId?: unknown },
  deps: AssistantDeps,
): Promise<AssistantResult> {
  const now = deps.now ?? new Date();
  const provider = deps.provider ?? null;
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

  const offline = await deps.assistant.reply(message, {
    data: deps.data,
    now,
    timeZone: deps.timeZone,
  });
  if (!offline.unmatched || !provider) {
    const { error: saveErr } = await supabase.from("ai_messages").insert({
      conversation_id: id,
      role: "assistant",
      content: offline.text.slice(0, 60000),
      provider: OFFLINE_PROVIDER,
      model: offline.intent ?? "fallback",
    });
    if (saveErr) return { ok: false, error: "The reply could not be saved.", conversationId: id };
    await supabase.from("ai_conversations").update({ title: undefined }).eq("id", id);
    return { ok: true, conversationId: id, reply: offline.text };
  }

  // Cloud path only. Cost control: signups are open, so cap how much one account can spend per day.
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
