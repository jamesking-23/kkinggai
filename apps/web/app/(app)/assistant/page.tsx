import { requireModule } from "../../../lib/modules";
import { getAppContext } from "../../../lib/session";
import { createClient } from "../../../lib/supabase/server";
import { Flash, subtleButton } from "../../../components/ui";
import { AssistantChat } from "../../../components/assistant-chat";
import { firstName } from "../../../lib/assistant-format";
import { ASSISTANT_MAX_MESSAGE_CHARS } from "@kkingg/schemas";
import { deleteConversation } from "./actions";

type Params = { c?: string; error?: string; message?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AssistantPage({ searchParams }: { searchParams: Promise<Params> }) {
  const ctx = await getAppContext();
  requireModule(ctx, "assistant");
  const { c, error, message } = await searchParams;
  const supabase = await createClient();

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

  const active = conversations?.find((x) => x.id === activeId);
  const nav = (
    <>
      <a href="/assistant" className={`${subtleButton} block text-center`}>
        + New chat
      </a>
      {(conversations ?? []).map((x) => (
        <a
          key={x.id}
          href={`/assistant?c=${x.id}`}
          className={`block truncate rounded-lg px-3 py-2 text-sm transition hover:bg-raised ${x.id === activeId ? "bg-raised font-medium" : "text-muted"}`}
        >
          {x.title}
        </a>
      ))}
    </>
  );
  return (
    <div className="mx-auto max-w-6xl">
      <Flash error={error} message={message} />
      <div className="grid gap-6 md:grid-cols-[14rem_1fr]">
        <nav aria-label="Conversations" className="hidden space-y-1 md:block md:pt-2">
          {nav}
        </nav>
        <details className="glass rounded-xl md:hidden">
          <summary className="cursor-pointer list-none px-4 py-2.5 text-sm">
            {active?.title ?? "New chat"} <span className="text-muted">· chats ▾</span>
          </summary>
          <nav aria-label="Conversations" className="space-y-1 p-2">
            {nav}
          </nav>
        </details>
        <section className="min-w-0">
          <AssistantChat
            key={activeId ?? "new"}
            initialMessages={(messages ?? []).map((m) => ({
              id: m.id,
              role: m.role === "user" ? "user" : "assistant",
              content: m.content,
              model: m.model,
            }))}
            conversationId={activeId}
            maxLength={ASSISTANT_MAX_MESSAGE_CHARS}
            name={firstName(ctx.displayName)}
          />
          {activeId && (
            <form action={deleteConversation} className="mt-2 text-center">
              <input type="hidden" name="id" value={activeId} />
              <button type="submit" className="text-xs text-muted hover:text-text">
                Delete this conversation
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
