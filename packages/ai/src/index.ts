/**
 * Provider-agnostic chat completion. SERVER-SIDE ONLY: providers take an API key, so never import
 * this package's provider factories from client components.
 */

export type ChatRole = "system" | "user" | "assistant";
export type ChatMessage = { role: ChatRole; content: string };
export type Usage = { inputTokens?: number; outputTokens?: number };
export type Completion = { text: string; usage: Usage; provider: string; model: string };

export type AiErrorKind =
  "not_configured" | "auth" | "rate_limit" | "upstream" | "bad_response" | "timeout";

/** Error messages are safe to show to the user: they never contain keys or raw provider bodies. */
export class AiError extends Error {
  constructor(
    readonly kind: AiErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "AiError";
  }
}

export type CompleteOptions = { maxOutputTokens?: number; temperature?: number };

export interface ChatProvider {
  readonly id: string;
  readonly model: string;
  complete(messages: ChatMessage[], options?: CompleteOptions): Promise<Completion>;
}

type FetchLike = typeof fetch;
type ProviderConfig = { apiKey: string; model: string; fetch?: FetchLike; timeoutMs?: number };

const DEFAULT_TIMEOUT_MS = 30_000;

async function post(
  doFetch: FetchLike,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number,
): Promise<unknown> {
  let res: Response;
  try {
    res = await doFetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError"))
      throw new AiError("timeout", "The AI provider took too long to respond.");
    throw new AiError("upstream", "Could not reach the AI provider.");
  }
  if (res.status === 401 || res.status === 403)
    throw new AiError("auth", "The AI provider rejected the API key.");
  if (res.status === 429)
    throw new AiError(
      "rate_limit",
      "The AI provider is rate limiting requests. Try again shortly.",
    );
  if (!res.ok) throw new AiError("upstream", `The AI provider returned an error (${res.status}).`);
  try {
    return await res.json();
  } catch {
    throw new AiError("bad_response", "The AI provider returned an unreadable response.");
  }
}

const num = (v: unknown) => (typeof v === "number" ? v : undefined);

export function geminiProvider(cfg: ProviderConfig): ChatProvider {
  return {
    id: "gemini",
    model: cfg.model,
    async complete(messages, options = {}) {
      const system = messages
        .filter((m) => m.role === "system")
        .map((m) => m.content)
        .join("\n\n");
      const contents = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));
      const json = (await post(
        cfg.fetch ?? fetch,
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`,
        { "x-goog-api-key": cfg.apiKey },
        {
          contents,
          ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
          generationConfig: {
            maxOutputTokens: options.maxOutputTokens,
            temperature: options.temperature,
          },
        },
        cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      )) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        usageMetadata?: { promptTokenCount?: unknown; candidatesTokenCount?: unknown };
      };
      const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      if (!text)
        throw new AiError(
          "bad_response",
          "The AI provider returned no text (it may have blocked the reply).",
        );
      return {
        text,
        usage: {
          inputTokens: num(json.usageMetadata?.promptTokenCount),
          outputTokens: num(json.usageMetadata?.candidatesTokenCount),
        },
        provider: "gemini",
        model: cfg.model,
      };
    },
  };
}

export function openRouterProvider(cfg: ProviderConfig): ChatProvider {
  return {
    id: "openrouter",
    model: cfg.model,
    async complete(messages, options = {}) {
      const json = (await post(
        cfg.fetch ?? fetch,
        "https://openrouter.ai/api/v1/chat/completions",
        { authorization: `Bearer ${cfg.apiKey}` },
        {
          model: cfg.model,
          messages,
          max_tokens: options.maxOutputTokens,
          temperature: options.temperature,
        },
        cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      )) as {
        choices?: { message?: { content?: unknown } }[];
        usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
      };
      const text = json.choices?.[0]?.message?.content;
      if (typeof text !== "string" || !text)
        throw new AiError("bad_response", "The AI provider returned no text.");
      return {
        text,
        usage: {
          inputTokens: num(json.usage?.prompt_tokens),
          outputTokens: num(json.usage?.completion_tokens),
        },
        provider: "openrouter",
        model: cfg.model,
      };
    },
  };
}

// Default model names are unverified guesses: set GEMINI_MODEL / OPENROUTER_MODEL to override.
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
export const DEFAULT_OPENROUTER_MODEL = "google/gemini-2.5-flash";

type Env = Record<string, string | undefined>;

/** Picks a provider from environment variables, or returns null when none is configured. AI_PROVIDER forces a choice. */
export function providerFromEnv(env: Env, fetchImpl?: FetchLike): ChatProvider | null {
  const gemini = env.GEMINI_API_KEY?.trim();
  const openrouter = env.OPENROUTER_API_KEY?.trim();
  const forced = env.AI_PROVIDER?.trim().toLowerCase();
  const useGemini = forced ? forced === "gemini" : Boolean(gemini);
  if (useGemini && gemini)
    return geminiProvider({
      apiKey: gemini,
      model: env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
      fetch: fetchImpl,
    });
  if ((!forced || forced === "openrouter") && openrouter)
    return openRouterProvider({
      apiKey: openrouter,
      model: env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL,
      fetch: fetchImpl,
    });
  return null;
}

/** Keeps the most recent messages that fit a rough character budget (about 4 characters per token). */
export function trimHistory(messages: ChatMessage[], maxChars: number): ChatMessage[] {
  const kept: ChatMessage[] = [];
  let total = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (total + m.content.length > maxChars && kept.length > 0) break;
    kept.unshift(m);
    total += m.content.length;
  }
  return kept;
}
