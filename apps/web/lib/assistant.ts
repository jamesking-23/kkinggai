import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AiError,
  trimHistory,
  type ChatMessage,
  type ChatProvider,
  type Completion,
} from "@kkingg/ai";
import {
  LlmOffline,
  LlmRefused,
  type AssistantData,
  type Fact,
  type Llm,
  type Pipeline,
} from "@kkingg/assistant";
import { ASSISTANT_DAILY_MESSAGE_LIMIT, assistantMessageSchema } from "@kkingg/schemas";
import type { Database } from "./supabase/database.types";

export const HISTORY_CHAR_BUDGET = 24_000;
export const MAX_OUTPUT_TOKENS = 1024;

export const SYSTEM_PROMPT =
  "You are the assistant inside KKINGG AI, a private personal operating system. " +
  "Be concise and practical. You can only see this conversation: you cannot read the user's tasks, goals, " +
  "vault or other data, and you must not claim to have done anything outside this chat. " +
  "Your answers may be stored and shown to other people who ask similar general questions, so never include " +
  "personal details, and say when you are unsure.";

/** The system prompt plus the public app facts that matter for this question (never any user data). */
export function systemPromptWith(facts: readonly Fact[]): string {
  if (facts.length === 0) return SYSTEM_PROMPT;
  return `${SYSTEM_PROMPT}\n\nFacts about the app (use them only if relevant):\n${facts.map((f) => `- ${f.text}`).join("\n")}`;
}

export type AssistantResult =
  | { ok: true; conversationId: string; reply: string }
  | { ok: false; error: string; conversationId: string | null };

export type AssistantDeps = {
  /** The three-tier pipeline: built-in commands, then the shared cache, then the online AI. */
  pipeline: Pick<Pipeline, "reply">;
  data: AssistantData;
  timeZone: string;
  /** The online AI (Gemini) used by Tier 3. Null means fully offline: Tiers 1 and 2 only. */
  provider?: ChatProvider | null;
  now?: Date;
};

export const OFFLINE_PROVIDER = "offline-router";
export const CACHE_PROVIDER = "response-cache";

type Stored = { role: string; content: string; provider: string | null };

/**
 * What may be sent to the online AI as conversation history: only the questions that were answered by the online AI or
 * the shared cache, with those answers. Commands answered by the built-in router (and the questions that triggered
 * them) are left out, because their replies contain the user's own tasks, goals and so on.
 */
export function cloudHistory(rows: Stored[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i]!;
    const b = rows[i + 1]!;
    if (
      a.role === "user" &&
      b.role === "assistant" &&
      b.provider &&
      b.provider !== OFFLINE_PROVIDER
    ) {
      out.push({ role: "user", content: a.content }, { role: "assistant", content: b.content });
      i++;
    }
  }
  return out;
}

/**
 * One assistant turn, shared by the website and the phone app. Runs on the server with the caller's own Supabase
 * client, so row-level security applies to everything the built-in commands read or change.
 *  Tier 1: the local model matches the message to a built-in command and runs it. No internet.
 *  Tier 2: a similar general question answered before comes back from the shared cache. No AI call.
 *  Tier 3: otherwise Gemini answers (question + public app facts only), and the answer is cached for others.
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
      .select("role, content, provider")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(200);
    history = cloudHistory(prior ?? []);
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

  let completion: Completion | null = null;
  const llm: Llm | null = provider
    ? async ({ query, facts }) => {
        // Cost control: signups are open, so cap how many online answers one account can use per day.
        const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        const { count } = await supabase
          .from("ai_messages")
          .select("id", { count: "exact", head: true })
          .eq("role", "assistant")
          .eq("provider", provider.id)
          .gte("created_at", since);
        if ((count ?? 0) >= ASSISTANT_DAILY_MESSAGE_LIMIT)
          throw new LlmRefused(
            `You have used your ${ASSISTANT_DAILY_MESSAGE_LIMIT} online answers for today. Built-in commands still work; try again tomorrow for open questions.`,
          );
        const messages: ChatMessage[] = [
          { role: "system", content: systemPromptWith(facts) },
          ...trimHistory([...history, { role: "user", content: query }], HISTORY_CHAR_BUDGET),
        ];
        try {
          completion = await provider.complete(messages, { maxOutputTokens: MAX_OUTPUT_TOKENS });
          return completion.text;
        } catch (e) {
          if (e instanceof AiError) {
            if (e.kind === "upstream" || e.kind === "timeout") throw new LlmOffline(e.message);
            throw new LlmRefused(e.message);
          }
          throw e;
        }
      }
    : null;

  const r = await deps.pipeline.reply(message, {
    data: deps.data,
    now,
    timeZone: deps.timeZone,
    llm,
  });

  const done = completion as Completion | null;
  const { error: saveErr } = await supabase.from("ai_messages").insert({
    conversation_id: id,
    role: "assistant",
    content: r.text.slice(0, 60000),
    provider:
      r.tier === 3 && done ? done.provider : r.tier === 2 ? CACHE_PROVIDER : OFFLINE_PROVIDER,
    model: r.tier === 3 && done ? done.model : (r.intent ?? (r.tier === 2 ? "cache" : "fallback")),
    input_tokens: r.tier === 3 && done ? (done.usage.inputTokens ?? null) : null,
    output_tokens: r.tier === 3 && done ? (done.usage.outputTokens ?? null) : null,
  });
  if (saveErr) return { ok: false, error: "The reply could not be saved.", conversationId: id };

  // Touch the conversation so it sorts first (the revision trigger refreshes updated_at).
  await supabase.from("ai_conversations").update({ title: undefined }).eq("id", id);
  return { ok: true, conversationId: id, reply: r.text };
}

/** The token from an `Authorization: Bearer <token>` header, or null. */
export function bearerToken(header: string | null | undefined): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec((header ?? "").trim());
  return m?.[1] ?? null;
}
