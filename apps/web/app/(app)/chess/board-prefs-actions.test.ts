import { beforeEach, describe, expect, it, vi } from "vitest";

const st = vi.hoisted(() => ({
  settings: null as unknown,
  updates: [] as Record<string, unknown>[],
  updateRows: [{ user_id: "u1" }] as { user_id: string }[],
  error: null as { message: string } | null,
}));

vi.mock("../../../lib/session", () => ({ getAppContext: async () => ({ userId: "u1" }) }));
vi.mock("../../../lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { settings: st.settings } }) }),
      }),
      update: (v: Record<string, unknown>) => {
        st.updates.push(v);
        return { eq: () => ({ select: async () => ({ data: st.updateRows, error: st.error }) }) };
      },
    }),
  }),
}));

import { DEFAULT_PREFS } from "../../../lib/board-prefs";
import { loadBoardPrefs, saveBoardPrefs } from "./board-prefs-actions";

beforeEach(() => {
  st.settings = { keep: 1 };
  st.updates = [];
  st.updateRows = [{ user_id: "u1" }];
  st.error = null;
});

describe("board preference actions", () => {
  it("loads null when nothing is saved and the block when it is", async () => {
    expect(await loadBoardPrefs()).toBeNull();
    st.settings = { board: { at: 7, prefs: { pieces: "celtic" } } };
    expect((await loadBoardPrefs())?.prefs.pieces).toBe("celtic");
  });
  it("saves while keeping other settings", async () => {
    const at = Date.now();
    expect(await saveBoardPrefs(DEFAULT_PREFS, at)).toBe(true);
    const saved = st.updates[0]!.settings as Record<string, unknown>;
    expect(saved.keep).toBe(1);
    expect((saved.board as { at: number }).at).toBe(at);
  });
  it("refuses a save that is older than the stored one", async () => {
    const at = Date.now();
    st.settings = { board: { at, prefs: {} } };
    expect(await saveBoardPrefs(DEFAULT_PREFS, at - 1000)).toBe(false);
    expect(st.updates).toHaveLength(0);
  });
  it("refuses nonsense and far-future timestamps", async () => {
    expect(await saveBoardPrefs(DEFAULT_PREFS, Number.NaN)).toBe(false);
    expect(await saveBoardPrefs(DEFAULT_PREFS, -1)).toBe(false);
    expect(await saveBoardPrefs(DEFAULT_PREFS, Date.now() + 3_600_000)).toBe(false);
  });
  it("sanitises hostile prefs before storing", async () => {
    await saveBoardPrefs({ ...DEFAULT_PREFS, size: 1e9, theme: "<x>" }, Date.now());
    const board = (st.updates[0]!.settings as { board: { prefs: typeof DEFAULT_PREFS } }).board;
    expect(board.prefs.size).toBe(880);
    expect(board.prefs.theme).toBe(DEFAULT_PREFS.theme);
  });
  it("reports failure when the update errors or matches no row", async () => {
    st.error = { message: "x" };
    expect(await saveBoardPrefs(DEFAULT_PREFS, Date.now())).toBe(false);
    st.error = null;
    st.updateRows = [];
    expect(await saveBoardPrefs(DEFAULT_PREFS, Date.now())).toBe(false);
  });
});
