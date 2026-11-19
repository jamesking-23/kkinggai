import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../../../../lib/session", () => ({
  getAppContext: async () => ({ current: { id: "ws-1" }, userId: "u-1" }),
}));

const TASK = "44444444-4444-4444-8444-444444444444";
const st = {
  task: { id: TASK } as { id: string } | null,
  insertError: null as { message: string } | null,
  uploadError: null as { message: string } | null,
  inserted: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[],
  uploads: [] as string[],
  updateData: [{ id: "a-1" }] as { id: string }[],
};

vi.mock("../../../../lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === "tasks")
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ is: () => ({ maybeSingle: async () => ({ data: st.task }) }) }),
            }),
          }),
        };
      return {
        insert: (row: Record<string, unknown>) => {
          st.inserted.push(row);
          return {
            select: () => ({
              single: async () =>
                st.insertError
                  ? { data: null, error: st.insertError }
                  : { data: { id: "a-1" }, error: null },
            }),
          };
        },
        update: (patch: Record<string, unknown>) => {
          st.updates.push(patch);
          const chain = {
            eq: () => chain,
            select: async () => ({ data: st.updateData, error: null }),
            then: (r: (v: unknown) => void) => r({ error: null }),
          };
          return chain;
        },
      };
    },
    storage: {
      from: () => ({
        upload: async (path: string) => {
          st.uploads.push(path);
          return { error: st.uploadError };
        },
      }),
    },
  }),
}));

import { addAttachment, removeAttachment } from "./attachments";

async function call(fn: (f: FormData) => Promise<void>, fields: Record<string, string | File>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  try {
    await fn(fd);
  } catch (e) {
    return decodeURIComponent((e as Error).message);
  }
  return "no redirect";
}
const pdf = (size = 10, type = "application/pdf", name = "a b.pdf") =>
  new File([new Uint8Array(size)], name, { type });

beforeEach(() => {
  st.task = { id: TASK };
  st.insertError = null;
  st.uploadError = null;
  st.inserted = [];
  st.updates = [];
  st.uploads = [];
  st.updateData = [{ id: "a-1" }];
});

describe("addAttachment", () => {
  it("rejects a malformed task id", async () => {
    expect(await call(addAttachment, { taskId: "nope", file: pdf() })).toContain("/tasks?error=");
    expect(st.inserted).toHaveLength(0);
  });
  it("requires a non-empty file", async () => {
    const r = await call(addAttachment, { taskId: TASK, file: pdf(0) });
    expect(r).toContain("Choose a file");
  });
  it("rejects files over 4 MB", async () => {
    const r = await call(addAttachment, { taskId: TASK, file: pdf(4 * 1024 * 1024 + 1) });
    expect(r).toContain("under 4 MB");
    expect(st.inserted).toHaveLength(0);
  });
  it("rejects disallowed types, including legacy .doc", async () => {
    expect(await call(addAttachment, { taskId: TASK, file: pdf(10, "application/zip") })).toContain(
      "not allowed",
    );
    expect(
      await call(addAttachment, { taskId: TASK, file: pdf(10, "application/msword") }),
    ).toContain("not allowed");
  });
  it("stops when the task is gone", async () => {
    st.task = null;
    expect(await call(addAttachment, { taskId: TASK, file: pdf() })).toContain("no longer exists");
    expect(st.uploads).toHaveLength(0);
  });
  it("records metadata first, then uploads into the task folder", async () => {
    const r = await call(addAttachment, { taskId: TASK, file: pdf() });
    expect(r).toContain("File attached");
    expect(st.inserted).toHaveLength(1);
    const path = st.inserted[0]!.storage_path as string;
    expect(path.startsWith(`ws-1/${TASK}/`)).toBe(true);
    expect(path).not.toContain(" ");
    expect(st.uploads).toEqual([path]);
  });
  it("does not upload when the metadata insert fails", async () => {
    st.insertError = { message: "denied" };
    expect(await call(addAttachment, { taskId: TASK, file: pdf() })).toContain("Could not attach");
    expect(st.uploads).toHaveLength(0);
  });
  it("soft-deletes the row when the upload fails", async () => {
    st.uploadError = { message: "boom" };
    expect(await call(addAttachment, { taskId: TASK, file: pdf() })).toContain("Could not upload");
    expect(st.updates).toHaveLength(1);
    expect(st.updates[0]).toHaveProperty("deleted_at");
  });
});

describe("removeAttachment", () => {
  it("soft-deletes", async () => {
    const r = await call(removeAttachment, { id: "a-1", taskId: TASK, revision: "1" });
    expect(r).toContain("Attachment removed");
    expect(st.updates[0]).toHaveProperty("deleted_at");
  });
  it("reports a stale revision", async () => {
    st.updateData = [];
    const r = await call(removeAttachment, { id: "a-1", taskId: TASK, revision: "1" });
    expect(r).toContain("changed elsewhere");
  });
});
