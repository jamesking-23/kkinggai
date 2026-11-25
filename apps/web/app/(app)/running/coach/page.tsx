import { cloudProvider } from "../../../../lib/offline-assistant";
import { ASSISTANT_MAX_MESSAGE_CHARS } from "@kkingg/schemas";
import { requireModule } from "../../../../lib/modules";
import { getAppContext } from "../../../../lib/session";
import { createClient } from "../../../../lib/supabase/server";
import {
  Flash,
  inputClass,
  PageHeader,
  primaryButton,
  subtleButton,
} from "../../../../components/ui";
import { askCoach } from "./actions";

type Params = { c?: string; error?: string; message?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PREFIX = "Running coach: ";

export default async function CoachPage({ searchParams }: { searchParams: Promise<Params> }) {
  const ctx = await getAppContext();
  requireModule(ctx, "running");
  const { c, error, message } = await searchParams;
  const supabase = await createClient();
  const provider = cloudProvider(process.env);

  const { data: conversations } = await supabase
    .from("ai_conversations")
    .select("id, title")
    .like("title", `${PREFIX}%`)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(20);
  const activeId = c && UUID.test(c) && conversations?.some((x) => x.id === c) ? c : null;
  const { data: messages } = activeId
    ? await supabase
        .from("ai_messages")
        .select("id, role, content")
        .eq("conversation_id", activeId)
        .order("created_at", { ascending: true })
    : { data: [] };

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-2 text-sm">
        <a href="/running" className="text-primary">
          ← Running
        </a>
      </p>
      <PageHeader title="Running coach" subtitle="Ask about your training. Advice only." />
      <Flash error={error} message={message} />
      {!provider && (
        <p className="mb-4 rounded-md border border-border px-3 py-2 text-sm text-muted">
          The AI coach is off because this app runs fully offline. Ask the Assistant for a
          &quot;running report&quot; for your weekly totals and plan instead. To enable cloud chat,
          set a provider key and ASSISTANT_CLOUD_FALLBACK=1 on the server.
        </p>
      )}
      <p className="mb-4 text-xs text-muted">
        Each question sends your message and a summary of your last 8 weeks to the configured AI
        provider: dates, distances, times, climb, heart rate, effort, and this and next week&apos;s
        plan sessions. Run names, notes and GPS routes are not sent. This is not medical advice;
        stop and see a professional for pain or illness. Coach chats are stored with your assistant
        chats and share its daily message limit.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <a href="/running/coach" className={subtleButton}>
          New question
        </a>
        {(conversations ?? []).map((x) => (
          <a
            key={x.id}
            href={`/running/coach?c=${x.id}`}
            className={`${subtleButton} max-w-[16rem] truncate ${x.id === activeId ? "font-medium" : ""}`}
          >
            {x.title.slice(PREFIX.length)}
          </a>
        ))}
      </div>

      {(messages ?? []).length > 0 && (
        <ul className="mb-4 space-y-3">
          {(messages ?? []).map((m) => (
            <li
              key={m.id}
              className={`whitespace-pre-wrap rounded-lg border border-border px-4 py-3 text-sm ${m.role === "user" ? "bg-surface" : "bg-bg"}`}
            >
              <p className="mb-1 text-xs text-muted">{m.role === "user" ? "You" : "Coach"}</p>
              {m.content}
            </li>
          ))}
        </ul>
      )}

      <form action={askCoach} className="space-y-2">
        {activeId && <input type="hidden" name="conversationId" value={activeId} />}
        <textarea
          name="message"
          required
          rows={3}
          maxLength={ASSISTANT_MAX_MESSAGE_CHARS}
          placeholder="e.g. How was my last week? Should I change anything before my long run?"
          aria-label="Your question"
          className={inputClass}
        />
        <button type="submit" className={primaryButton}>
          Ask the coach
        </button>
      </form>
    </div>
  );
}
