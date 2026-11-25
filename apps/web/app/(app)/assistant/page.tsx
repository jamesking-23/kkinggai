import { requireModule } from "../../../lib/modules";
import { getAppContext } from "../../../lib/session";
import { createClient } from "../../../lib/supabase/server";
import { Flash, subtleButton } from "../../../components/ui";
import { AssistantComposer } from "../../../components/assistant-composer";
import { ASSISTANT_MAX_MESSAGE_CHARS } from "@kkingg/schemas";
import { deleteConversation, sendMessage } from "./actions";

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

  const empty = !activeId;
  return (
    <div className="mx-auto max-w-5xl">
      <Flash error={error} message={message} />
      <div className="grid gap-6 md:grid-cols-[13rem_1fr]">
        <nav aria-label="Conversations" className="space-y-1 md:pt-2">
          <a href="/assistant" className={`${subtleButton} block text-center`}>
            New conversation
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
        </nav>

        <section className="min-w-0">
          {empty ? (
            <div className="flex flex-col items-center pt-6 text-center md:pt-12">
              <div className="orb" aria-hidden />
              <h1 className="hero-title mt-14 text-4xl md:text-5xl">
                What&apos;s on your mind today?
              </h1>
              <p className="mt-3 text-sm text-muted">
                Commands run on the server with no outside calls. Try &quot;add task buy milk
                tomorrow&quot;, &quot;my tasks&quot;, &quot;calculate 15% of 80000&quot; or
                &quot;help&quot;. Open questions may use a stored answer or an online AI (Gemini),
                which sees only your question and public app facts, never your tasks, notes or
                vault.
              </p>
              <div className="mt-8 w-full max-w-2xl text-left">
                <AssistantComposer
                  action={sendMessage}
                  conversationId={null}
                  maxLength={ASSISTANT_MAX_MESSAGE_CHARS}
                  showSuggestions
                />
              </div>
            </div>
          ) : (
            <>
              <div className="mb-6 space-y-4">
                {(messages ?? []).map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
                        m.role === "user" ? "btn-primary text-white" : "glass text-text"
                      }`}
                    >
                      {m.role !== "user" && m.model && (
                        <p className="mb-1 text-[11px] uppercase tracking-wider text-muted">
                          {m.model}
                        </p>
                      )}
                      {m.content}
                    </div>
                  </div>
                ))}
              </div>
              <div className="sticky bottom-4">
                <AssistantComposer
                  action={sendMessage}
                  conversationId={activeId}
                  maxLength={ASSISTANT_MAX_MESSAGE_CHARS}
                  showSuggestions={false}
                />
              </div>
              <form action={deleteConversation} className="mt-6">
                <input type="hidden" name="id" value={activeId} />
                <button type="submit" className={subtleButton}>
                  Delete conversation
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
