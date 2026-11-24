// Assistant helpers for the phone app. Pure. The phone never talks to the AI provider: it calls the site's
// /api/assistant with its own sign-in token, and the provider key stays on the server.

export const MAX_MESSAGE_CHARS = 4000; // keep in sync with ASSISTANT_MAX_MESSAGE_CHARS in packages/schemas

export type ConversationRow = { id: string; title: string; updated_at: string };
export type MessageRow = { id: string; role: "user" | "assistant" | "system"; content: string };

export type AssistantReply =
  | { ok: true; conversationId: string; reply: string }
  | { ok: false; error: string; conversationId: string | null };

/** Trimmed message, or an error message. */
export function checkMessage(text: string): string | { message: string } {
  const m = text.trim();
  if (!m) return "Type a message.";
  if (m.length > MAX_MESSAGE_CHARS)
    return `Messages are limited to ${MAX_MESSAGE_CHARS} characters.`;
  return { message: m };
}

/** Turns the server's JSON answer (or a network failure) into a result the screen can show. */
export function parseReply(status: number, body: unknown): AssistantReply {
  const b = (body ?? {}) as { error?: unknown; conversationId?: unknown; reply?: unknown };
  const cid = typeof b.conversationId === "string" ? b.conversationId : null;
  if (status >= 200 && status < 300 && typeof b.reply === "string" && cid)
    return { ok: true, conversationId: cid, reply: b.reply };
  if (status === 401)
    return { ok: false, error: "Your session expired. Sign in again.", conversationId: cid };
  const error =
    typeof b.error === "string" && b.error ? b.error : "The assistant could not answer. Try again.";
  return { ok: false, error, conversationId: cid };
}

/** Request body for the server. A blank conversation id starts a new chat. */
export function requestBody(message: string, conversationId: string | null) {
  return JSON.stringify(conversationId ? { message, conversationId } : { message });
}

export function conversationTitle(c: Pick<ConversationRow, "title">): string {
  return c.title.trim() || "New chat";
}

/** Only user and assistant messages are shown; system messages are hidden. */
export function visibleMessages(list: readonly MessageRow[]): MessageRow[] {
  return list.filter((m) => m.role === "user" || m.role === "assistant");
}
