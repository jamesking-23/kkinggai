import { INTENTS } from "./intents";
import { createRouter, type Router } from "./router";
import {
  MissingInput,
  type ActionContext,
  type AssistantData,
  type Embedder,
  type Intent,
} from "./types";

export const FALLBACK_REPLY =
  "Sorry, I didn't understand that. I can run a set list of commands, like showing your tasks, adding a task, logging a run, " +
  'doing a calculation or searching. Say "help" to see them all.';

export type AssistantReply = {
  text: string;
  /** Which intent ran, or null for the fallback. */
  intent: string | null;
  score: number | null;
  /** True when no intent was confident enough, so the caller may offer another route. */
  unmatched: boolean;
};

export type Assistant = {
  readonly embedderName: string;
  readonly threshold: number;
  reply(
    text: string,
    env: { data: AssistantData; now?: Date; timeZone?: string },
  ): Promise<AssistantReply>;
};

/**
 * The offline assistant. Build it once at startup (this embeds every example phrase); then `reply` classifies a message
 * with the router and runs the matching deterministic function. Nothing here calls the network.
 */
export async function createAssistant(options: {
  embedder: Embedder;
  threshold?: number;
  intents?: Readonly<Record<string, Intent>>;
}): Promise<Assistant> {
  const intents = options.intents ?? INTENTS;
  const router: Router = await createRouter(intents, options.embedder, {
    threshold: options.threshold,
  });
  return {
    embedderName: router.embedderName,
    threshold: router.threshold,
    async reply(text, env) {
      const trimmed = text.trim();
      const hit = await router.route(trimmed);
      if (!hit.matched)
        return {
          text: FALLBACK_REPLY,
          intent: null,
          score: hit.best?.score ?? null,
          unmatched: true,
        };
      const ctx: ActionContext = {
        data: env.data,
        now: env.now ?? new Date(),
        timeZone: env.timeZone ?? "UTC",
        intents,
      };
      try {
        return {
          text: await intents[hit.id]!.run(ctx, trimmed),
          intent: hit.id,
          score: hit.score,
          unmatched: false,
        };
      } catch (e) {
        if (e instanceof MissingInput)
          return { text: e.message, intent: hit.id, score: hit.score, unmatched: false };
        return {
          text: "Something went wrong while doing that. Nothing was changed. Try again in a moment.",
          intent: hit.id,
          score: hit.score,
          unmatched: false,
        };
      }
    },
  };
}
