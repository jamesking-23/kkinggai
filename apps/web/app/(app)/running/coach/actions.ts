"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AiError, providerFromEnv, trimHistory, type ChatMessage } from "@kkingg/ai";
import { ASSISTANT_DAILY_MESSAGE_LIMIT, assistantMessageSchema } from "@kkingg/schemas";
import { buildCoachContext, COACH_SYSTEM_PROMPT } from "../../../../lib/coach";
import { getAppContext } from "../../../../lib/session";
import { createClient } from "../../../../lib/supabase/server";

const HISTORY_CHAR_BUDGET = 12_000;
const MAX_OUTPUT_TOKENS = 700;
const COACH_TITLE_PREFIX = "Running coach: ";

function back(id: string | null, kind: "error" | "message", text: string): never {
  const c = id ? `c=${id}&` : "";
  redirect(`/running/coach?${c}${kind}=${encodeURIComponent(text)}`);
}

export async function askCoach(formData: FormData) {
  const rawId = String(formData.get("conversationId") ?? "") || null;
  const parsed = assistantMessageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(rawId, "error", parsed.error.issues[0]?.message ?? "Invalid message");
  const { message } = parsed.data;

  const provider = providerFromEnv(process.env);
  if (!provider)
    back(rawId, "error", "The coach is not configured: no AI provider key is set on the server.");

  const ctx = await getAppContext();
  const supabase = await createClient();

  // Same daily cap as the assistant (they share one message store), to control cost.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("ai_messages")
    .select("id", { count: "exact", head: true })
    .eq("role", "user")
    .gte("created_at", since);
  if ((count ?? 0) >= ASSISTANT_DAILY_MESSAGE_LIMIT)
    back(
      rawId,
      "error",
      `Daily limit of ${ASSISTANT_DAILY_MESSAGE_LIMIT} messages reached. Try again tomorrow.`,
    );

  let conversationId = parsed.data.conversationId ?? null;
  let history: ChatMessage[] = [];
  if (conversationId) {
    const { data: conv } = await supabase
      .from("ai_conversations")
      .select("id, title")
      .eq("id", conversationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!conv || !conv.title.startsWith(COACH_TITLE_PREFIX))
      back(null, "error", "That conversation no longer exists.");
    const { data: prior } = await supabase
      .from("ai_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(100);
    history = (prior ?? []).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));
  } else {
    const { data: created, error } = await supabase
      .from("ai_conversations")
      .insert({ workspace_id: ctx.current.id, title: (COACH_TITLE_PREFIX + message).slice(0, 80) })
      .select("id")
      .single();
    if (error || !created) back(null, "error", "Could not start a conversation.");
    conversationId = created.id;
  }

  // Fresh data every time, so advice reflects the latest runs and plan.
  const eightWeeksAgo = new Date(Date.now() - 56 * 86_400_000).toISOString();
  const [{ data: runs }, { data: plan }] = await Promise.all([
    supabase
      .from("run_activities")
      .select("started_at, kind, distance_m, moving_seconds, elevation_gain_m, avg_hr, effort")
      .is("deleted_at", null)
      .gte("started_at", eightWeeksAgo)
      .order("started_at", { ascending: false })
      .limit(300),
    supabase
      .from("run_plans")
      .select("id, goal, race_date, weeks, days_per_week")
      .eq("status", "active")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const { data: sessions } = plan
    ? await supabase
        .from("run_plan_sessions")
        .select("planned_on, kind, distance_m, status")
        .eq("plan_id", plan.id)
        .order("planned_on", { ascending: true })
        .limit(400)
    : { data: [] };

  const data = buildCoachContext({
    runs: runs ?? [],
    plan: plan ?? null,
    sessions: sessions ?? [],
    now: new Date(),
    timeZone: ctx.timezone,
  });

  const { error: userErr } = await supabase
    .from("ai_messages")
    .insert({ conversation_id: conversationId, role: "user", content: message });
  if (userErr) back(conversationId, "error", "Could not save your message.");

  const messages: ChatMessage[] = [
    { role: "system", content: `${COACH_SYSTEM_PROMPT}\n\nTraining data:\n${data}` },
    ...trimHistory([...history, { role: "user", content: message }], HISTORY_CHAR_BUDGET),
  ];

  let reply;
  try {
    reply = await provider.complete(messages, { maxOutputTokens: MAX_OUTPUT_TOKENS });
  } catch (e) {
    back(
      conversationId,
      "error",
      e instanceof AiError ? e.message : "The coach failed unexpectedly.",
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
  await supabase.from("ai_conversations").update({ title: undefined }).eq("id", conversationId);
  revalidatePath("/running/coach");
  redirect(`/running/coach?c=${conversationId}`);
}
