import { providerFromEnv } from "@kkingg/ai";
import { requireModule } from "../../../lib/modules";
import { getAppContext } from "../../../lib/session";
import { createClient } from "../../../lib/supabase/server";
import { Flash, inputClass, PageHeader, primaryButton, subtleButton } from "../../../components/ui";
import { ASSISTANT_MAX_MESSAGE_CHARS } from "@kkingg/schemas";
import { deleteConversation, sendMessage } from "./actions";

type Params = { c?: string; error?: string; message?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AssistantPage({ searchParams }: { searchParams: Promise<Params> }) {
  const ctx = await getAppContext();
  requireModule(ctx, "assistant");
  const { c, error, message } = await searchParams;
  const supabase = await createClient();
  const provider = providerFromEnv(process.env);

  const { data: conversations } = await supabase
    .from("ai_conversations")
    .select("id, title")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(30);

  const activeId = c && UUID.test(c) && conversations?.some((x) => x.id === c) ? c : null;
  const { data: messages } = activeId
    ? await supabase
        .from("ai_messages")
        .select("id, role, content, model")
        .eq("conversation_id", activeId)
        .order("created_at", { ascending: true })
    : { data: [] };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Assistant" subtitle="Chat history is private to you." />
      <Flash error={error} message={message} />
      {!provider && (
        <p className="mb-4 rounded-md border border-border px-3 py-2 text-sm text-muted">
          The assistant is not configured yet: set GEMINI_API_KEY or OPENROUTER_API_KEY on the
          server. Until then it cannot reply.
        </p>
      )}
      <p className="mb-4 text-xs text-muted">
        The assistant only sees this conversation. It cannot read your tasks, goals or vault.
        Don&apos;t paste secrets.
      </p>

      <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
        <nav aria-label="Conversations" className="space-y-1">
          <a href="/assistant" className={`${subtleButton} block text-center`}>
            New conversation
          </a>
          {(conversations ?? []).map((x) => (
            <a
              key={x.id}
              href={`/assistant?c=${x.id}`}
              className={`block truncate rounded-md px-3 py-2 text-sm hover:bg-raised ${x.id === activeId ? "bg-raised font-medium" : ""}`}
            >
              {x.title}
            </a>
          ))}
        </nav>

        <section className="min-w-0">
          <div className="mb-4 space-y-3">
            {(messages ?? []).map((m) => (
              <div
                key={m.id}
                className={`whitespace-pre-wrap rounded-lg border border-border p-3 text-sm ${m.role === "user" ? "bg-surface" : "bg-bg"}`}
              >
                <p className="mb-1 text-xs text-muted">
                  {m.role === "user" ? "You" : `Assistant${m.model ? ` · ${m.model}` : ""}`}
                </p>
                {m.content}
              </div>
            ))}
            {!activeId && <p className="text-sm text-muted">Start a conversation below.</p>}
          </div>

          <form action={sendMessage} className="space-y-2">
            {activeId && <input type="hidden" name="conversationId" value={activeId} />}
            <textarea
              name="message"
              required
              rows={3}
              maxLength={ASSISTANT_MAX_MESSAGE_CHARS}
              placeholder="Ask something…"
              aria-label="Message"
              className={inputClass}
            />
            <button type="submit" className={primaryButton} disabled={!provider}>
              Send
            </button>
          </form>

          {activeId && (
            <form action={deleteConversation} className="mt-4">
              <input type="hidden" name="id" value={activeId} />
              <button type="submit" className={subtleButton}>
                Delete conversation
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
