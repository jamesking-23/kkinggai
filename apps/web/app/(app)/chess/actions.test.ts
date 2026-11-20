import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../../../lib/session", () => ({
  getAppContext: async () => ({ userId: "u-1", current: { id: "ws-1" } }),
}));

const st = {
  game: { pgn: "1. e4 e5 *" } as { pgn: string } | null,
  existing: null as { id: string } | null,
  writeError: null as { message: string } | null,
  inserted: [] as Record<string, unknown>[],
  updated: [] as Record<string, unknown>[],
};

vi.mock("../../../lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === "chess_games")
        return {
          select: () => ({
            eq: () => ({ is: () => ({ maybeSingle: async () => ({ data: st.game }) }) }),
          }),
        };
      return {
        select: () => ({
          eq: () => ({ is: () => ({ maybeSingle: async () => ({ data: st.existing }) }) }),
        }),
        insert: async (row: Record<string, unknown>) => {
          st.inserted.push(row);
          return { error: st.writeError };
        },
        update: (row: Record<string, unknown>) => {
          st.updated.push(row);
          return { eq: async () => ({ error: st.writeError }) };
        },
      };
    },
  }),
}));

import { saveAnalysis } from "./actions";

const GAME = "11111111-1111-4111-8111-111111111111";
const ev = { white: 20, bestUci: "e2e4", bestSan: "e4", depth: 14 };
const input = (n = 3) => ({ gameId: GAME, depth: 14, evals: Array.from({ length: n }, () => ev) });

beforeEach(() => {
  st.game = { pgn: "1. e4 e5 *" };
  st.existing = null;
  st.writeError = null;
  st.inserted = [];
  st.updated = [];
});

describe("saveAnalysis", () => {
  it("inserts a first analysis", async () => {
    expect(await saveAnalysis(input())).toEqual({ ok: true });
    expect(st.inserted).toHaveLength(1);
    expect(st.inserted[0]).toMatchObject({ game_id: GAME, depth: 14 });
  });
  it("replaces an existing analysis instead of adding a second", async () => {
    st.existing = { id: "a-1" };
    expect(await saveAnalysis(input())).toEqual({ ok: true });
    expect(st.updated).toHaveLength(1);
    expect(st.inserted).toHaveLength(0);
  });
  it("refuses an analysis with the wrong number of positions", async () => {
    const r = await saveAnalysis(input(5));
    expect(r).toEqual({ ok: false, error: "The analysis does not match this game" });
    expect(st.inserted).toHaveLength(0);
  });
  it("refuses a malformed payload", async () => {
    expect((await saveAnalysis({ gameId: "x" })).ok).toBe(false);
    expect((await saveAnalysis({ ...input(), depth: 99 })).ok).toBe(false);
  });
  it("reports a missing game", async () => {
    st.game = null;
    expect(await saveAnalysis(input())).toEqual({ ok: false, error: "Game not found" });
  });
  it("reports a database failure", async () => {
    st.writeError = { message: "boom" };
    expect(await saveAnalysis(input())).toEqual({
      ok: false,
      error: "Could not save the analysis",
    });
  });
});
