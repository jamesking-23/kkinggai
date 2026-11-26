import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { copyAttachments } from "./copy-attachments";

const WS = "11111111-1111-4111-8111-111111111111";
const FROM = "22222222-2222-4222-8222-222222222222";
const TO = "33333333-3333-4333-8333-333333333333";

function fake(
  rows: Record<string, unknown>[],
  opts: { failCopy?: string; failInsert?: boolean } = {},
) {
  const copies: { from: string; to: string }[] = [];
  const inserts: Record<string, unknown>[] = [];
  const client = {
    from: () => ({
      select: () => ({ eq: () => ({ is: async () => ({ data: rows, error: null }) }) }),
      insert: async (row: Record<string, unknown>) => {
        inserts.push(row);
        return { error: opts.failInsert ? { message: "x" } : null };
      },
    }),
    storage: {
      from: () => ({
        copy: async (from: string, to: string) => {
          copies.push({ from, to });
          return { error: from === opts.failCopy ? { message: "nope" } : null };
        },
      }),
    },
  } as unknown as SupabaseClient;
  return { client, copies, inserts };
}

const row = (name: string) => ({
  storage_path: `${WS}/${FROM}/${name}`,
  file_name: name,
  mime_type: "application/pdf",
  size_bytes: 10,
});

describe("copyAttachments", () => {
  it("copies each file into the new task's folder and adds a row", async () => {
    const f = fake([row("a.pdf"), row("my file.pdf")]);
    expect(await copyAttachments(f.client, WS, FROM, TO)).toBe(2);
    expect(f.copies[0]!.to.startsWith(`${WS}/${TO}/`)).toBe(true);
    expect(f.copies[1]!.to.endsWith("-my_file.pdf")).toBe(true);
    expect(f.inserts[0]).toMatchObject({ workspace_id: WS, task_id: TO, file_name: "a.pdf" });
    expect((f.inserts[0]!.storage_path as string).startsWith(`${WS}/${TO}/`)).toBe(true);
  });

  it("skips a file that fails to copy and keeps going", async () => {
    const f = fake([row("a.pdf"), row("b.pdf")], { failCopy: `${WS}/${FROM}/a.pdf` });
    expect(await copyAttachments(f.client, WS, FROM, TO)).toBe(1);
    expect(f.inserts).toHaveLength(1);
  });

  it("does not count a file whose row could not be saved", async () => {
    const f = fake([row("a.pdf")], { failInsert: true });
    expect(await copyAttachments(f.client, WS, FROM, TO)).toBe(0);
  });

  it("returns 0 and does not throw on a broken client", async () => {
    expect(await copyAttachments({} as SupabaseClient, WS, FROM, TO)).toBe(0);
  });
});
