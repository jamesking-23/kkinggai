import { beforeEach, describe, expect, it, vi } from "vitest";

const st = vi.hoisted(() => ({
  settings: null as unknown,
  updates: [] as Record<string, unknown>[],
  rows: [{ user_id: "u1" }] as { user_id: string }[],
  error: null as { message: string } | null,
}));

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("../../../lib/session", () => ({
  getAppContext: async () => ({ userId: "u1", timezone: "Africa/Kampala" }),
}));
vi.mock("../../../lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { settings: st.settings } }) }),
      }),
      update: (v: Record<string, unknown>) => {
        st.updates.push(v);
        return { eq: () => ({ select: async () => ({ data: st.rows, error: st.error }) }) };
      },
    }),
  }),
}));

import { loadQuietHours, saveQuietHours } from "./actions";

beforeEach(() => {
  st.settings = { board: { at: 1 } };
  st.updates = [];
  st.rows = [{ user_id: "u1" }];
  st.error = null;
});

describe("quiet hours actions", () => {
  it("loads null, then the saved window", async () => {
    expect(await loadQuietHours()).toBeNull();
    st.settings = { push_quiet: { from: "22:00", to: "07:00" } };
    expect(await loadQuietHours()).toEqual({ from: "22:00", to: "07:00" });
  });
  it("saves a window and keeps other settings", async () => {
    const r = await saveQuietHours({ from: "22:00", to: "07:00" });
    expect(r.ok).toBe(true);
    expect(r.message).toContain("Africa/Kampala");
    expect(st.updates[0]).toEqual({
      settings: { board: { at: 1 }, push_quiet: { from: "22:00", to: "07:00" } },
    });
  });
  it("clears the window with null", async () => {
    st.settings = { board: { at: 1 }, push_quiet: { from: "22:00", to: "07:00" } };
    const r = await saveQuietHours(null);
    expect(r).toEqual({ ok: true, message: "Quiet hours are off." });
    expect(st.updates[0]).toEqual({ settings: { board: { at: 1 } } });
  });
  it("rejects bad times and equal times without writing", async () => {
    expect((await saveQuietHours({ from: "25:00", to: "07:00" })).ok).toBe(false);
    expect((await saveQuietHours({ from: "7", to: "08:00" })).ok).toBe(false);
    expect((await saveQuietHours({ from: "10:00", to: "10:00" })).ok).toBe(false);
    expect(st.updates).toHaveLength(0);
  });
  it("reports a failed or empty update", async () => {
    st.error = { message: "x" };
    expect((await saveQuietHours({ from: "22:00", to: "07:00" })).ok).toBe(false);
    st.error = null;
    st.rows = [];
    expect((await saveQuietHours({ from: "22:00", to: "07:00" })).ok).toBe(false);
  });
});

import { loadPushKinds, savePushKinds } from "./actions";

describe("push kinds actions", () => {
  it("loads all kinds by default and the saved subset after", async () => {
    expect(await loadPushKinds()).toHaveLength(5);
    st.settings = { push_kinds: ["date"] };
    expect(await loadPushKinds()).toEqual(["date"]);
  });
  it("saves a subset, ignoring unknown kinds, and keeps other settings", async () => {
    const r = await savePushKinds(["reminder", "bogus"]);
    expect(r).toEqual({ ok: true, message: "Saved." });
    expect(st.updates[0]).toEqual({ settings: { board: { at: 1 }, push_kinds: ["reminder"] } });
  });
  it("says so when nothing will be pushed, and removes the key when all are on", async () => {
    expect((await savePushKinds([])).message).toBe("Nothing will be pushed.");
    st.settings = { push_kinds: ["date"] };
    await savePushKinds(["date", "application", "venture_task", "puzzles", "reminder"]);
    expect(st.updates[1]).toEqual({ settings: {} });
  });
  it("reports a failed update", async () => {
    st.error = { message: "x" };
    expect((await savePushKinds(["date"])).ok).toBe(false);
  });
});
