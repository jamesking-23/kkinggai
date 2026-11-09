"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AiError, providerFromEnv, trimHistory, type ChatMessage } from "@kkingg/ai";
import { ASSISTANT_DAILY_MESSAGE_LIMIT, assistantMessageSchema } from "@kkingg/schemas";
import { getAppContext } from "../../../lib/session";
import { createClient } from "../../../lib/supabase/server";

const HISTORY_CHAR_BUDGET = 24_000;
const MAX_OUTPUT_TOKENS = 1024;

const SYSTEM_PROMPT =
  "You are the assistant inside KKINGG AI, a private personal operating system. " +
  "Be concise and practical. You can only see this conversation: you cannot read the user's tasks, goals, " +
  "vault or other data, and you must not claim to have done anything outside this chat.";

function back(conversationId: string | null, kind: "error" | "message", text: string): never {
  const c = conversationId ? `c=${conversationId}&` : "";
  redirect(`/assistant?${c}${kind}=${encodeURIComponent(text)}`);
}

export async function sendMessage(formData: FormData) {
  const rawId = String(formData.get("conversationId") ?? "") || null;
  const parsed = assistantMessageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(rawId, "error", parsed.error.issues[0]?.message ?? "Invalid message");
  const { message } = parsed.data;

  const provider = providerFromEnv(process.env);
  if (!provider)
    back(
      rawId,
      "error",
      "The assistant is not configured: no AI provider key is set on the server.",
    );

  const ctx = await getAppContext();
  const supabase = await createClient();

  // Cost control: signups are open, so cap how much one account can spend per day.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("ai_messages")
    .select("id", { count: "exact", head: true })
    .eq("role", "user")
    .gte("created_at", since);
  if ((count ?? 0) >= ASSISTANT_DAILY_MESSAGE_LIMIT)
    back(
      parsed.data.conversationId ?? null,
      "error",
      `Daily limit of ${ASSISTANT_DAILY_MESSAGE_LIMIT} messages reached. Try again tomorrow.`,
    );

  let conversationId = parsed.data.conversationId ?? null;
  let history: ChatMessage[] = [];
  if (conversationId) {
    const { data: conv } = await supabase
      .from("ai_conversations")
      .select("id")
      .eq("id", conversationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!conv) back(null, "error", "That conversation no longer exists.");
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
      .insert({ workspace_id: ctx.current.id, title: message.slice(0, 60) })
      .select("id")
      .single();
    if (error || !created) back(null, "error", "Could not start a conversation.");
    conversationId = created.id;
  }

  // Store the user's message first so it is never lost if the provider fails.
  const { error: userErr } = await supabase
    .from("ai_messages")
    .insert({ conversation_id: conversationId, role: "user", content: message });
  if (userErr) back(conversationId, "error", "Could not save your message.");

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...trimHistory([...history, { role: "user", content: message }], HISTORY_CHAR_BUDGET),
  ];

  let reply;
  try {
    reply = await provider.complete(messages, { maxOutputTokens: MAX_OUTPUT_TOKENS });
  } catch (e) {
    back(
      conversationId,
      "error",
      e instanceof AiError ? e.message : "The assistant failed unexpectedly.",
    );
  }

  const { error: saveErr } = await supabase.from("ai_messages").insert({
    conversation_id: conversationId,
    role: "assistant",
    content: reply.text.slice(0, 60000),
    provider: reply.provider,
    model: reply.model,
    input_tokens: reply.usage.inputTokens ?? null,
    output_tokens: reply.usage.outputTokens ?? null,
  });
  if (saveErr) back(conversationId, "error", "The reply was generated but could not be saved.");

  // Touch the conversation so it sorts first (the revision trigger refreshes updated_at).
  await supabase.from("ai_conversations").update({ title: undefined }).eq("id", conversationId);
  revalidatePath("/assistant");
  redirect(`/assistant?c=${conversationId}`);
}

export async function deleteConversation(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_conversations")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) back(id, "error", "Could not delete the conversation.");
  revalidatePath("/assistant");
  redirect("/assistant?message=" + encodeURIComponent("Conversation deleted"));
}
