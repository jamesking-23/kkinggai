import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

type GameRow = {
  status: string;
  moves: string[];
  white_id: string | null;
  black_id: string | null;
  resigned_by: string | null;
};
type Game = GameRow | null;
const WHITE = "11111111-1111-4111-8111-111111111111";
const BLACK = "22222222-2222-4222-8222-222222222222";
const GID = "33333333-3333-4333-8333-333333333333";
const st = {
  user: WHITE as string | null,
  game: null as Game,
  rpcCalls: [] as { fn: string; args: Record<string, unknown> }[],
  rpcResult: { data: null as unknown, error: null as { message: string } | null },
};

vi.mock("../../../../lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: st.user ? { id: st.user } : null } }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: st.game }) }) }),
    }),
    rpc: async (fn: string, args: Record<string, unknown>) => {
      st.rpcCalls.push({ fn, args });
      return st.rpcResult;
    },
  }),
}));

import { claimTimeout, createGame, drawAction, joinGame, playMove, resignGame } from "./actions";

const active = (moves: string[] = []): GameRow => ({
  status: "active",
  moves,
  white_id: WHITE,
  black_id: BLACK,
  resigned_by: null,
});
async function call(fn: (f: FormData) => Promise<void>, fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  try {
    await fn(fd);
  } catch (e) {
    return decodeURIComponent((e as Error).message);
  }
  return "no redirect";
}

beforeEach(() => {
  st.user = WHITE;
  st.game = active();
  st.rpcCalls = [];
  st.rpcResult = { data: 1, error: null };
});

describe("playMove", () => {
  it("records a legal move for the player whose turn it is, with the current ply", async () => {
    const out = await call(playMove, { id: GID, uci: "e2e4" });
    expect(out).toBe(`REDIRECT:/chess/play/${GID}`);
    expect(st.rpcCalls).toEqual([
      { fn: "mp_move", args: { game: GID, expected_ply: 0, uci: "e2e4" } },
    ]);
  });

  it("rejects an illegal move without calling the database", async () => {
    const out = await call(playMove, { id: GID, uci: "e2e5" });
    expect(out).toContain("That move is not legal");
    expect(st.rpcCalls).toHaveLength(0);
  });

  it("rejects a move when it is the opponent's turn", async () => {
    st.user = BLACK;
    expect(await call(playMove, { id: GID, uci: "e7e5" })).toContain("It is not your turn");
    expect(st.rpcCalls).toHaveLength(0);
  });

  it("rejects a non-participant and a signed-out caller", async () => {
    st.user = "44444444-4444-4444-8444-444444444444";
    expect(await call(playMove, { id: GID, uci: "e2e4" })).toContain("not in progress");
    st.user = null;
    expect(await call(playMove, { id: GID, uci: "e2e4" })).toContain("not in progress");
    expect(st.rpcCalls).toHaveLength(0);
  });

  it("rejects moves in a finished or waiting game and when the game is missing", async () => {
    st.game = { ...active(), status: "resigned" };
    expect(await call(playMove, { id: GID, uci: "e2e4" })).toContain("not in progress");
    st.game = { ...active(), status: "waiting" };
    expect(await call(playMove, { id: GID, uci: "e2e4" })).toContain("not in progress");
    st.game = null;
    expect(await call(playMove, { id: GID, uci: "e2e4" })).toContain("not in progress");
    expect(st.rpcCalls).toHaveLength(0);
  });

  it("rejects a move after checkmate even though the status is still active", async () => {
    st.game = active(["f2f3", "e7e5", "g2g4", "d8h4"]); // fool's mate: white to move, checkmated
    const out = await call(playMove, { id: GID, uci: "a2a3" });
    expect(out).toContain("not in progress");
    expect(st.rpcCalls).toHaveLength(0);
  });

  it("rejects malformed ids and move strings", async () => {
    expect(await call(playMove, { id: "nope", uci: "e2e4" })).toContain("Invalid move");
    expect(await call(playMove, { id: GID, uci: "e2e9" })).toContain("Invalid move");
    expect(st.rpcCalls).toHaveLength(0);
  });

  it("shows the database's message when it refuses the move", async () => {
    st.rpcResult = { data: null, error: { message: "The board changed. Reload and try again." } };
    expect(await call(playMove, { id: GID, uci: "e2e4" })).toContain("The board changed");
  });
});

describe("other game actions", () => {
  it("joinGame validates the invite code before calling the database", async () => {
    expect(await call(joinGame, { code: "short" })).toContain("not valid");
    expect(st.rpcCalls).toHaveLength(0);
    st.rpcResult = { data: GID, error: null };
    const code = "0123456789abcdef0123456789abcdef";
    expect(await call(joinGame, { code })).toBe(`REDIRECT:/chess/play/${GID}`);
    expect(st.rpcCalls[0]).toEqual({ fn: "mp_join", args: { code } });
  });

  it("createGame uses the chosen colour and a valid colour for anything else", async () => {
    st.rpcResult = { data: [{ id: GID, invite_code: "x" }], error: null };
    await call(createGame, { color: "black" });
    expect(st.rpcCalls[0]!.args).toMatchObject({ color: "black" });
    await call(createGame, { color: "purple" });
    expect(["white", "black"]).toContain(st.rpcCalls[1]!.args.color);
  });

  it("createGame passes the time control and rejects an unknown one", async () => {
    st.rpcResult = { data: [{ id: GID, invite_code: "x" }], error: null };
    await call(createGame, { color: "white", control: "15+10" });
    expect(st.rpcCalls[0]!.args).toEqual({ color: "white", minutes: 15, increment: 10 });
    await call(createGame, { color: "white" });
    expect(st.rpcCalls[1]!.args).toEqual({ color: "white", minutes: null, increment: 0 });
    expect(await call(createGame, { color: "white", control: "1+99" })).toContain("time control");
    expect(st.rpcCalls).toHaveLength(2);
  });

  it("claimTimeout validates the id and shows the database's refusal", async () => {
    expect(await call(claimTimeout, { id: "bad" })).toContain("Invalid game");
    st.rpcResult = { data: null, error: { message: "The clock has not run out yet" } };
    expect(await call(claimTimeout, { id: GID })).toContain("The clock has not run out yet");
    expect(st.rpcCalls.map((c) => c.fn)).toEqual(["mp_claim_timeout"]);
  });

  it("createGame shows the database's message, e.g. too many open games", async () => {
    st.rpcResult = { data: null, error: { message: "You have too many open games." } };
    expect(await call(createGame, { color: "white" })).toContain("too many open games");
  });

  it("resign and draw actions only pass valid input to the database", async () => {
    expect(await call(resignGame, { id: "bad" })).toContain("Invalid game");
    expect(await call(drawAction, { id: GID, action: "steal" })).toContain("Invalid request");
    expect(st.rpcCalls).toHaveLength(0);
    await call(resignGame, { id: GID });
    await call(drawAction, { id: GID, action: "offer" });
    expect(st.rpcCalls.map((c) => c.fn)).toEqual(["mp_resign", "mp_draw"]);
  });
});
