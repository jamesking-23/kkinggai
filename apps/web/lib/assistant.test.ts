import { describe, expect, it, vi } from "vitest";
import { AiError, type ChatProvider } from "@kkingg/ai";
import { ASSISTANT_DAILY_MESSAGE_LIMIT } from "@kkingg/schemas";
import type { AssistantData } from "@kkingg/assistant";
import { bearerToken, runAssistantTurn, type AssistantDeps } from "./assistant";

type Call = { table: string; op: string; arg?: unknown };

/** A tiny fake of the Supabase query builder: every chain resolves to the scripted result for table+op. */
function fake(script: Record<string, unknown>) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      let op = "select";
      let arg: unknown;
      const chain: Record<string, unknown> = {};
      const done = () => {
        calls.push({ table, op, arg });
        const r = script[`${table}.${op}`];
        return Promise.resolve(r ?? { data: null, error: null });
      };
      for (const m of ["eq", "is", "gte", "order", "limit", "select"]) chain[m] = () => chain;
      chain.insert = (v: unknown) => {
        op = "insert";
        arg = v;
        return chain;
      };
      chain.update = (v: unknown) => {
        op = "update";
        arg = v;
        return chain;
      };
      chain.single = done;
      chain.maybeSingle = done;
      chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
        done().then(res, rej);
      return chain;
    },
  };
  return { client: client as never, calls };
}

const ok: ChatProvider = {
  complete: vi.fn(async () => ({
    text: "Hello!",
    usage: { inputTokens: 3, outputTokens: 2 },
    provider: "test",
    model: "m",
  })),
} as unknown as ChatProvider;

const data = {} as AssistantData;
const matched = {
  text: "You have 2 open tasks.",
  intent: "list_open_tasks",
  score: 0.9,
  unmatched: false,
};
const unmatched = { text: "I didn't catch that.", intent: null, score: 0.1, unmatched: true };
const offline = (r: typeof matched | typeof unmatched) => ({ reply: vi.fn(async () => r) });
const deps = (r: typeof matched | typeof unmatched, provider?: ChatProvider): AssistantDeps => ({
  assistant: offline(r),
  data,
  timeZone: "UTC",
  provider,
});

const uuid = "11111111-1111-4111-8111-111111111111";

describe("runAssistantTurn", () => {
  it("rejects an empty message", async () => {
    const { client } = fake({});
    const r = await runAssistantTurn(client, "ws", { message: "  " }, deps(unmatched, ok));
    expect(r).toEqual({ ok: false, error: "Type a message", conversationId: null });
  });

  it("stops at the daily limit without calling the cloud provider", async () => {
    const p = { complete: vi.fn() } as unknown as ChatProvider;
    const { client } = fake({ "ai_messages.select": { count: ASSISTANT_DAILY_MESSAGE_LIMIT } });
    const r = await runAssistantTurn(client, "ws", { message: "hi" }, deps(unmatched, p));
    expect(r.ok).toBe(false);
    expect(p.complete).not.toHaveBeenCalled();
  });

  it("answers from the offline router and never calls the cloud provider or the daily cap", async () => {
    const p = { complete: vi.fn() } as unknown as ChatProvider;
    const { client, calls } = fake({
      "ai_messages.select": { count: ASSISTANT_DAILY_MESSAGE_LIMIT },
      "ai_conversations.insert": { data: { id: uuid }, error: null },
    });
    const r = await runAssistantTurn(client, "ws", { message: "my tasks" }, deps(matched, p));
    expect(r).toEqual({ ok: true, conversationId: uuid, reply: matched.text });
    expect(p.complete).not.toHaveBeenCalled();
    const saved = calls.filter((c) => c.table === "ai_messages" && c.op === "insert");
    expect((saved[1]!.arg as { provider: string }).provider).toBe("offline-router");
  });

  it("replies with the polite fallback when offline and nothing matches (no provider)", async () => {
    const { client } = fake({ "ai_conversations.insert": { data: { id: uuid }, error: null } });
    const r = await runAssistantTurn(client, "ws", { message: "asdf" }, deps(unmatched));
    expect(r).toEqual({ ok: true, conversationId: uuid, reply: unmatched.text });
  });

  it("falls back to the cloud provider only when one is passed and the router did not match", async () => {
    const { client, calls } = fake({
      "ai_messages.select": { count: 0 },
      "ai_conversations.insert": { data: { id: uuid }, error: null },
    });
    const r = await runAssistantTurn(client, "ws", { message: "hi there" }, deps(unmatched, ok));
    expect(r).toEqual({ ok: true, conversationId: uuid, reply: "Hello!" });
    const inserts = calls.filter((c) => c.table === "ai_messages" && c.op === "insert");
    expect(inserts).toHaveLength(2);
    expect((inserts[0]!.arg as { role: string }).role).toBe("user");
    expect((inserts[1]!.arg as { role: string }).role).toBe("assistant");
  });

  it("reports a vanished conversation", async () => {
    const { client } = fake({
      "ai_messages.select": { count: 0 },
      "ai_conversations.select": { data: null, error: null },
    });
    const r = await runAssistantTurn(
      client,
      "ws",
      { message: "hi", conversationId: uuid },
      deps(unmatched, ok),
    );
    expect(r).toEqual({
      ok: false,
      error: "That conversation no longer exists.",
      conversationId: null,
    });
  });

  it("keeps the user's message when the provider fails and shows the provider's message", async () => {
    const bad = {
      complete: vi.fn(async () => {
        throw new AiError("rate_limit", "The AI provider is busy. Try again soon.");
      }),
    } as unknown as ChatProvider;
    const { client, calls } = fake({
      "ai_messages.select": { count: 0 },
      "ai_conversations.insert": { data: { id: uuid }, error: null },
    });
    const r = await runAssistantTurn(client, "ws", { message: "hi" }, deps(unmatched, bad));
    expect(r.ok).toBe(false);
    expect(r).toMatchObject({ conversationId: uuid });
    expect(calls.filter((c) => c.table === "ai_messages" && c.op === "insert")).toHaveLength(1);
  });
});

describe("bearerToken", () => {
  it("reads the token", () => {
    expect(bearerToken("Bearer abc.def")).toBe("abc.def");
    expect(bearerToken("bearer  x")).toBe("x");
    expect(bearerToken("Basic abc")).toBeNull();
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken("Bearer")).toBeNull();
  });
});
