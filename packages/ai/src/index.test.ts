import { describe, expect, it } from "vitest";
import { AiError, geminiProvider, openRouterProvider, providerFromEnv, trimHistory } from "./index";

const ok = (body: unknown) => async () => new Response(JSON.stringify(body), { status: 200 });
const status = (code: number) => async () => new Response("{}", { status: code });
const msgs = [
  { role: "system" as const, content: "Be brief." },
  { role: "user" as const, content: "Hi" },
  { role: "assistant" as const, content: "Hello" },
  { role: "user" as const, content: "Again" },
];

describe("gemini provider", () => {
  it("maps roles, sends the key as a header and parses text and usage", async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const p = geminiProvider({
      apiKey: "KEY",
      model: "m1",
      fetch: async (url, init) => {
        seen = { url: String(url), init: init! };
        return new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "Hel" }, { text: "lo" }] } }],
            usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2 },
          }),
        );
      },
    });
    const r = await p.complete(msgs);
    expect(r).toMatchObject({
      text: "Hello",
      usage: { inputTokens: 5, outputTokens: 2 },
      provider: "gemini",
    });
    expect(seen!.url).not.toContain("KEY");
    expect((seen!.init.headers as Record<string, string>)["x-goog-api-key"]).toBe("KEY");
    const body = JSON.parse(seen!.init.body as string);
    expect(body.systemInstruction.parts[0].text).toBe("Be brief.");
    expect(body.contents.map((c: { role: string }) => c.role)).toEqual(["user", "model", "user"]);
  });

  it("reports an empty reply as a bad response", async () => {
    const p = geminiProvider({ apiKey: "k", model: "m", fetch: ok({ candidates: [] }) });
    await expect(p.complete(msgs)).rejects.toMatchObject({ kind: "bad_response" });
  });
});

describe("openrouter provider", () => {
  it("sends a bearer token and parses the reply", async () => {
    let auth = "";
    const p = openRouterProvider({
      apiKey: "KEY",
      model: "vendor/m",
      fetch: async (_u, init) => {
        auth = (init!.headers as Record<string, string>).authorization!;
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: "Hi!" } }],
            usage: { prompt_tokens: 3, completion_tokens: 1 },
          }),
        );
      },
    });
    const r = await p.complete(msgs);
    expect(auth).toBe("Bearer KEY");
    expect(r).toMatchObject({
      text: "Hi!",
      usage: { inputTokens: 3, outputTokens: 1 },
      provider: "openrouter",
    });
  });
});

describe("error mapping", () => {
  it.each([
    [401, "auth"],
    [403, "auth"],
    [429, "rate_limit"],
    [500, "upstream"],
  ])("maps HTTP %i to %s without leaking the key", async (code, kind) => {
    const p = openRouterProvider({ apiKey: "SECRET", model: "m", fetch: status(code) });
    const err = await p.complete(msgs).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AiError);
    expect((err as AiError).kind).toBe(kind);
    expect((err as AiError).message).not.toContain("SECRET");
  });

  it("maps a network failure and a timeout", async () => {
    const down = openRouterProvider({
      apiKey: "k",
      model: "m",
      fetch: async () => Promise.reject(new TypeError("boom")),
    });
    await expect(down.complete(msgs)).rejects.toMatchObject({ kind: "upstream" });
    const slow = openRouterProvider({
      apiKey: "k",
      model: "m",
      timeoutMs: 20,
      fetch: (_u, init) =>
        new Promise((_res, rej) =>
          init!.signal!.addEventListener("abort", () => rej(init!.signal!.reason)),
        ),
    });
    await expect(slow.complete(msgs)).rejects.toMatchObject({ kind: "timeout" });
  });
});

describe("providerFromEnv", () => {
  it("returns null when nothing is configured", () => {
    expect(providerFromEnv({})).toBeNull();
    expect(providerFromEnv({ GEMINI_API_KEY: "  " })).toBeNull();
  });
  it("prefers gemini, falls back to openrouter, honours AI_PROVIDER", () => {
    expect(providerFromEnv({ GEMINI_API_KEY: "a", OPENROUTER_API_KEY: "b" })?.id).toBe("gemini");
    expect(providerFromEnv({ OPENROUTER_API_KEY: "b" })?.id).toBe("openrouter");
    expect(
      providerFromEnv({ GEMINI_API_KEY: "a", OPENROUTER_API_KEY: "b", AI_PROVIDER: "openrouter" })
        ?.id,
    ).toBe("openrouter");
    expect(providerFromEnv({ GEMINI_API_KEY: "a", AI_PROVIDER: "openrouter" })).toBeNull();
  });
  it("uses a model override", () => {
    expect(providerFromEnv({ GEMINI_API_KEY: "a", GEMINI_MODEL: "custom" })?.model).toBe("custom");
  });
});

describe("trimHistory", () => {
  it("keeps the newest messages within budget but never returns empty", () => {
    const h = [1, 2, 3].map((n) => ({ role: "user" as const, content: "x".repeat(10) + n }));
    expect(trimHistory(h, 25)).toHaveLength(2);
    expect(trimHistory(h, 1)).toHaveLength(1);
    expect(trimHistory(h, 1)[0]!.content.endsWith("3")).toBe(true);
  });
});
