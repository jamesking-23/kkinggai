import { describe, expect, it, vi } from "vitest";
import { AiError, type ChatProvider } from "@kkingg/ai";
import { ASSISTANT_DAILY_MESSAGE_LIMIT } from "@kkingg/schemas";
import {
  LlmOffline,
  LlmRefused,
  type AssistantData,
  type Llm,
  type PipelineEnv,
  type PipelineReply,
} from "@kkingg/assistant";
import { bearerToken, cloudHistory, runAssistantTurn, type AssistantDeps } from "./assistant";

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
  id: "test",
  complete: vi.fn(async () => ({
    text: "Hello!",
    usage: { inputTokens: 3, outputTokens: 2 },
    provider: "test",
    model: "m",
  })),
} as unknown as ChatProvider;

const data = {} as AssistantData;
const t1: PipelineReply = {
  text: "You have 2 open tasks.",
  intent: "list_open_tasks",
  score: 0.9,
  unmatched: false,
  tier: 1,
};
const t2: PipelineReply = {
  text: "Stored answer.",
  intent: null,
  score: 0.95,
  unmatched: false,
  tier: 2,
};

/** A pipeline that answers Tier 1 or 2 directly, or asks the Tier 3 function it was given. */
function pipe(kind: PipelineReply | "tier3") {
  const seen: { llm?: Llm | null }[] = [];
  return {
    seen,
    reply: vi.fn(async (message: string, env: PipelineEnv): Promise<PipelineReply> => {
      seen.push({ llm: env.llm });
      if (kind !== "tier3") return kind;
      if (!env.llm) return { text: "fallback", intent: null, score: 0, unmatched: true, tier: 0 };
      try {
        const text = await env.llm({ query: message, facts: [] });
        return { text, intent: null, score: 0, unmatched: false, tier: 3 };
      } catch (e) {
        if (e instanceof LlmOffline)
          return { text: "OFFLINE", intent: null, score: 0, unmatched: true, tier: 0 };
        if (e instanceof LlmRefused)
          return { text: e.message, intent: null, score: 0, unmatched: true, tier: 0 };
        throw e;
      }
    }),
  };
}
const deps = (
  pipeline: ReturnType<typeof pipe>,
  provider?: ChatProvider | null,
): AssistantDeps => ({ pipeline, data, timeZone: "UTC", provider });

const uuid = "11111111-1111-4111-8111-111111111111";
const saved = (calls: Call[]) =>
  calls.filter((c) => c.table === "ai_messages" && c.op === "insert");

describe("runAssistantTurn", () => {
  it("rejects an empty message", async () => {
    const { client } = fake({});
    const r = await runAssistantTurn(client, "ws", { message: "  " }, deps(pipe(t1), ok));
    expect(r).toEqual({ ok: false, error: "Type a message", conversationId: null });
  });

  it("Tier 1: returns the command's reply, stores it as offline-router, no online AI", async () => {
    const { client, calls } = fake({
      "ai_conversations.insert": { data: { id: uuid }, error: null },
    });
    const p = { id: "gemini", complete: vi.fn() } as unknown as ChatProvider;
    const r = await runAssistantTurn(client, "ws", { message: "my tasks" }, deps(pipe(t1), p));
    expect(r).toEqual({ ok: true, conversationId: uuid, reply: t1.text });
    expect(p.complete).not.toHaveBeenCalled();
    expect((saved(calls)[1]!.arg as { provider: string }).provider).toBe("offline-router");
  });

  it("Tier 2: a cached answer is stored as response-cache and costs no online call", async () => {
    const { client, calls } = fake({
      "ai_conversations.insert": { data: { id: uuid }, error: null },
    });
    const r = await runAssistantTurn(
      client,
      "ws",
      { message: "capital of uganda" },
      deps(pipe(t2), ok),
    );
    expect(r).toMatchObject({ ok: true, reply: "Stored answer." });
    expect(ok.complete).not.toHaveBeenCalled();
    expect((saved(calls)[1]!.arg as { provider: string }).provider).toBe("response-cache");
  });

  it("Tier 3: calls the online AI with a system prompt and records its provider and tokens", async () => {
    const { client, calls } = fake({
      "ai_messages.select": { count: 0 },
      "ai_conversations.insert": { data: { id: uuid }, error: null },
    });
    const r = await runAssistantTurn(
      client,
      "ws",
      { message: "explain tides" },
      deps(pipe("tier3"), ok),
    );
    expect(r).toEqual({ ok: true, conversationId: uuid, reply: "Hello!" });
    const sent = vi.mocked(ok.complete).mock.calls.at(-1)![0];
    expect(sent[0]!.role).toBe("system");
    const row = saved(calls)[1]!.arg as { provider: string; input_tokens: number };
    expect(row.provider).toBe("test");
    expect(row.input_tokens).toBe(3);
  });

  it("stops Tier 3 at the daily limit without calling the online AI and says so", async () => {
    const p = { id: "gemini", complete: vi.fn() } as unknown as ChatProvider;
    const { client } = fake({
      "ai_messages.select": { count: ASSISTANT_DAILY_MESSAGE_LIMIT },
      "ai_conversations.insert": { data: { id: uuid }, error: null },
    });
    const r = await runAssistantTurn(
      client,
      "ws",
      { message: "explain tides" },
      deps(pipe("tier3"), p),
    );
    expect(r.ok && r.reply).toMatch(/online answers for today/);
    expect(p.complete).not.toHaveBeenCalled();
  });

  it("gives the friendly offline reply when the online AI cannot be reached", async () => {
    const bad = {
      id: "gemini",
      complete: vi.fn(async () => {
        throw new AiError("upstream", "Could not reach the AI provider.");
      }),
    } as unknown as ChatProvider;
    const { client } = fake({
      "ai_messages.select": { count: 0 },
      "ai_conversations.insert": { data: { id: uuid }, error: null },
    });
    const r = await runAssistantTurn(
      client,
      "ws",
      { message: "explain tides" },
      deps(pipe("tier3"), bad),
    );
    expect(r).toEqual({ ok: true, conversationId: uuid, reply: "OFFLINE" });
  });

  it("is fully offline when no provider is configured", async () => {
    const { client } = fake({ "ai_conversations.insert": { data: { id: uuid }, error: null } });
    const pl = pipe("tier3");
    const r = await runAssistantTurn(client, "ws", { message: "explain tides" }, deps(pl, null));
    expect(r.ok && r.reply).toBe("fallback");
    expect(pl.seen[0]!.llm).toBeNull();
  });

  it("reports a provider-side failure to the user as a reply, not a crash", async () => {
    const bad = {
      id: "gemini",
      complete: vi.fn(async () => {
        throw new AiError("rate_limit", "The AI provider is rate limiting requests.");
      }),
    } as unknown as ChatProvider;
    const { client } = fake({
      "ai_messages.select": { count: 0 },
      "ai_conversations.insert": { data: { id: uuid }, error: null },
    });
    const r = await runAssistantTurn(
      client,
      "ws",
      { message: "explain tides" },
      deps(pipe("tier3"), bad),
    );
    expect(r.ok && r.reply).toMatch(/rate limiting/);
  });

  it("keeps command replies (your tasks, goals...) out of what the online AI sees", () => {
    const rows = [
      { role: "user", content: "my tasks", provider: null },
      { role: "assistant", content: "You have: pay rent", provider: "offline-router" },
      { role: "user", content: "explain tides", provider: null },
      { role: "assistant", content: "Tides come from the moon.", provider: "gemini" },
    ];
    expect(cloudHistory(rows)).toEqual([
      { role: "user", content: "explain tides" },
      { role: "assistant", content: "Tides come from the moon." },
    ]);
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
