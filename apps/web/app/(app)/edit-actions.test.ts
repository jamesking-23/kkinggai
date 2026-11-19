import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../../lib/session", () => ({
  getAppContext: async () => ({ current: { id: "ws" }, timezone: "Africa/Kampala", userId: "u" }),
}));

const st = {
  calls: [] as { table: string; update: Record<string, unknown>; filters: [string, unknown][] }[],
  rows: [{ id: "x" }] as { id: string }[],
  error: null as { message: string } | null,
};
vi.mock("../../lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => ({
      update: (update: Record<string, unknown>) => {
        const call = { table, update, filters: [] as [string, unknown][] };
        st.calls.push(call);
        const q = {
          eq: (c: string, v: unknown) => (call.filters.push([c, v]), q),
          is: (c: string, v: unknown) => (call.filters.push([c, v]), q),
          select: async () => ({ data: st.rows, error: st.error }),
        };
        return q;
      },
    }),
  }),
}));

import { updateEvent } from "./calendar/actions";
import { updateGoal } from "./goals/actions";
import { updateProject } from "./projects/actions";

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
  st.calls = [];
  st.rows = [{ id: "x" }];
  st.error = null;
});

describe("updateProject", () => {
  const base = { id: "p1", revision: "3", name: "Website", description: "", dueDate: "" };
  it("saves with the revision guard and clears blank optional fields", async () => {
    expect(await run(updateProject, base)).toContain("/projects?message=Project saved");
    expect(st.calls[0]).toMatchObject({
      table: "projects",
      update: { name: "Website", description: "", due_date: null },
    });
    expect(st.calls[0]!.filters).toContainEqual(["revision", 3]);
    expect(st.calls[0]!.filters).toContainEqual(["id", "p1"]);
  });
  it("rejects an empty name without touching the database", async () => {
    expect(await run(updateProject, { ...base, name: "   " })).toContain("Enter a project name");
    expect(st.calls).toHaveLength(0);
  });
  it("reports a conflict when no row matched the revision", async () => {
    st.rows = [];
    expect(await run(updateProject, base)).toContain("changed elsewhere");
  });
});

describe("updateGoal", () => {
  const base = {
    id: "g1",
    revision: "2",
    title: "Run 500 km",
    targetValue: "500",
    unit: "km",
    deadline: "2026-12-31",
  };
  it("saves target, unit and deadline", async () => {
    expect(await run(updateGoal, base)).toContain("/goals?message=Goal saved");
    expect(st.calls[0]!.update).toEqual({
      title: "Run 500 km",
      target_value: 500,
      unit: "km",
      deadline: "2026-12-31",
    });
  });
  it("clears the target, unit and deadline when blank", async () => {
    await run(updateGoal, { ...base, targetValue: "", unit: "", deadline: "" });
    expect(st.calls[0]!.update).toEqual({
      title: "Run 500 km",
      target_value: null,
      unit: null,
      deadline: null,
    });
  });
  it("rejects a zero target and a database error", async () => {
    expect(await run(updateGoal, { ...base, targetValue: "0" })).toContain("above zero");
    expect(st.calls).toHaveLength(0);
    st.error = { message: "x" };
    expect(await run(updateGoal, base)).toContain("Could not save the goal");
  });
});

describe("updateEvent", () => {
  const base = {
    id: "e1",
    revision: "1",
    title: "Lecture",
    startsAt: "2026-11-20T09:00",
    endsAt: "2026-11-20T10:00",
    location: "",
  };
  it("converts the local times to UTC using the workspace time zone", async () => {
    expect(await run(updateEvent, base)).toContain("/calendar?message=Event saved");
    expect(st.calls[0]!.update).toEqual({
      title: "Lecture",
      location: null,
      starts_at: "2026-11-20T06:00:00.000Z",
      ends_at: "2026-11-20T07:00:00.000Z",
    });
    expect(st.calls[0]!.filters).toContainEqual(["revision", 1]);
    expect(st.calls[0]!.filters).toContainEqual(["deleted_at", null]);
  });
  it("rejects an end before the start and reports a conflict", async () => {
    expect(await run(updateEvent, { ...base, endsAt: "2026-11-20T08:00" })).toContain(
      "End must not be before start",
    );
    expect(st.calls).toHaveLength(0);
    st.rows = [];
    expect(await run(updateEvent, base)).toContain("changed elsewhere");
  });
});
