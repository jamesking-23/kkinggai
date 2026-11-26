import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../../../lib/copy-attachments", () => ({ copyAttachments: vi.fn(async () => 0) }));
vi.mock("../../../lib/session", () => ({
  getAppContext: async () => ({ current: { id: "ws" }, timezone: "Africa/Kampala", userId: "u" }),
}));

const st = {
  task: null as { recurrence_rule: string | null; due_at: string | null } | null,
  rpc: [] as { fn: string; args: Record<string, unknown> }[],
  rpcResult: { data: null as string | boolean | null, error: null as { message: string } | null },
  inserted: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[],
  updateRows: [{ id: "x" }] as { id: string }[],
};
vi.mock("../../../lib/supabase/server", () => ({
  createClient: async () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      st.rpc.push({ fn, args });
      return st.rpcResult;
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: st.task }) }) }),
      insert: async (row: Record<string, unknown>) => (st.inserted.push(row), { error: null }),
      update: (row: Record<string, unknown>) => {
        st.updates.push(row);
        const q = { eq: () => q, select: async () => ({ data: st.updateRows, error: null }) };
        return q;
      },
    }),
  }),
}));

import { createTask, toggleTask } from "./actions";

async function run(fn: (f: FormData) => Promise<void>, fields: Record<string, string>) {
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
  vi.useRealTimers();
  st.task = null;
  st.rpc = [];
  st.rpcResult = { data: null, error: null };
  st.inserted = [];
  st.updates = [];
  st.updateRows = [{ id: "x" }];
});

describe("createTask repeat", () => {
  it("stores the rule for the chosen repeat and null otherwise", async () => {
    await run(createTask, { title: "Water plants", priority: "3", repeat: "weekly" });
    expect(st.inserted[0]).toMatchObject({ recurrence_rule: "FREQ=WEEKLY" });
    await run(createTask, { title: "Once", priority: "3", repeat: "" });
    expect(st.inserted[1]).toMatchObject({ recurrence_rule: null });
  });
  it("rejects an unknown repeat", async () => {
    expect(await run(createTask, { title: "x", priority: "3", repeat: "hourly" })).toContain(
      "REDIRECT:/tasks?error=",
    );
    expect(st.inserted).toHaveLength(0);
  });
});

describe("toggleTask", () => {
  it("completing a recurring task asks for the next copy on the next occurrence", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-19T08:00:00Z")); // 11:00 in Kampala, still 19 Nov
    st.task = { recurrence_rule: "FREQ=WEEKLY", due_at: "2026-11-19T20:59:00Z" }; // due end of 19 Nov, Kampala
    st.rpcResult = { data: "new-id", error: null };
    const out = await run(toggleTask, { id: "t1", revision: "4", done: "1" });
    expect(out).toContain("The next one is scheduled");
    expect(st.rpc).toEqual([
      {
        fn: "complete_task",
        args: { task_id: "t1", expected_revision: 4, next_due: "2026-11-26T20:59:00.000Z" },
      },
    ]);
  });
  it("skips missed occurrences when the task is completed late", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-19T08:00:00Z"));
    st.task = { recurrence_rule: "FREQ=DAILY", due_at: "2026-11-01T20:59:00Z" };
    await run(toggleTask, { id: "t1", revision: "1", done: "1" });
    expect(st.rpc[0]!.args.next_due).toBe("2026-11-19T20:59:00.000Z");
  });
  it("a plain task passes no next date and says so", async () => {
    st.task = { recurrence_rule: null, due_at: null };
    expect(await run(toggleTask, { id: "t1", revision: "1", done: "1" })).toContain(
      "message=Task completed",
    );
    expect(st.rpc[0]!.args.next_due).toBeNull();
  });
  it("shows the conflict message from the database and a generic one otherwise", async () => {
    st.task = { recurrence_rule: null, due_at: null };
    st.rpcResult = {
      data: null,
      error: { message: "This task was changed elsewhere. Reload and try again." },
    };
    expect(await run(toggleTask, { id: "t1", revision: "1", done: "1" })).toContain(
      "changed elsewhere",
    );
    st.rpcResult = { data: null, error: { message: "boom" } };
    expect(await run(toggleTask, { id: "t1", revision: "1", done: "1" })).toContain(
      "Could not update the task",
    );
  });
  it("reopening calls reopen_task, not complete_task", async () => {
    expect(await run(toggleTask, { id: "t1", revision: "2", done: "0" })).toContain(
      "Task reopened",
    );
    expect(st.rpc).toEqual([{ fn: "reopen_task", args: { task_id: "t1", expected_revision: 2 } }]);
  });
  it("says when reopening removed the scheduled copy", async () => {
    st.rpcResult = { data: true, error: null };
    expect(await run(toggleTask, { id: "t1", revision: "2", done: "0" })).toContain("removed");
  });
  it("reports a conflict when reopening a stale task", async () => {
    st.rpcResult = {
      data: null,
      error: { message: "This task was changed elsewhere. Reload and try again." },
    };
    expect(await run(toggleTask, { id: "t1", revision: "2", done: "0" })).toContain(
      "changed elsewhere",
    );
  });
});
