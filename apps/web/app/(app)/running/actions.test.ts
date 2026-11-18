import { beforeEach, describe, expect, it, vi } from "vitest";

// `redirect` throws in Next; the mock does the same so the code after a flash() never runs, as in production.
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

type Row = Record<string, unknown>;
const state = { existing: new Set<string>(), inserted: [] as Row[], failInsert: false };

vi.mock("../../../lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => {
      let key: string | null = null;
      const q = {
        select: () => q,
        eq: (col: string, v: string) => {
          if (col === "external_id") key = v;
          return q;
        },
        is: () => q,
        limit: async () => ({ data: key && state.existing.has(key) ? [{ id: "dup" }] : [] }),
        insert: (row: Row) => ({
          select: () => ({
            single: async () => {
              if (state.failInsert) return { data: null, error: { message: "x" } };
              state.inserted.push(row);
              return { data: { id: `run-${state.inserted.length}` }, error: null };
            },
          }),
        }),
      };
      return q;
    },
  }),
}));

import { importGpx } from "./actions";

function gpx(startMin: number, n = 30) {
  const pts = Array.from({ length: n }, (_, i) => {
    const t = new Date(Date.UTC(2026, 10, 1, 6, startMin, i * 5)).toISOString();
    return `<trkpt lat="${(0.3 + i * 0.00004).toFixed(6)}" lon="32.5"><ele>1200</ele><time>${t}</time></trkpt>`;
  });
  return `<?xml version="1.0"?><gpx><trk><name>Run ${startMin}</name><trkseg>${pts.join("")}</trkseg></trk></gpx>`;
}
const file = (name: string, text: string) => new File([text], name);
async function run(fields: Record<string, string>, files: File[]) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  for (const f of files) fd.append("file", f);
  try {
    await importGpx(fd);
  } catch (e) {
    return decodeURIComponent((e as Error).message);
  }
  return "no redirect";
}

beforeEach(() => {
  state.existing = new Set();
  state.inserted = [];
  state.failInsert = false;
});

describe("importGpx", () => {
  it("rejects a request with no files", async () => {
    expect(await run({ origin: "strava", kind: "easy" }, [])).toContain("Choose at least one");
  });

  it("imports several files and labels them with the chosen origin", async () => {
    const out = await run({ origin: "mapmyrun", kind: "long" }, [
      file("a.gpx", gpx(0)),
      file("b.gpx", gpx(40)),
    ]);
    expect(out).toContain("/running?message=2 imported");
    expect(state.inserted).toHaveLength(2);
    expect(state.inserted[0]).toMatchObject({ source: "mapmyrun", kind: "long", name: "Run 0" });
  });

  it("goes to the run page when exactly one file is imported", async () => {
    const out = await run({ origin: "strava", kind: "easy", name: "Morning" }, [
      file("a.gpx", gpx(0)),
    ]);
    expect(out).toContain("/running/run-1?message=Run imported");
    expect(state.inserted[0]).toMatchObject({ name: "Morning", source: "strava" });
  });

  it("ignores the typed name when several files are uploaded", async () => {
    await run({ origin: "gpx", kind: "easy", name: "Same" }, [
      file("a.gpx", gpx(0)),
      file("b.gpx", gpx(40)),
    ]);
    expect(state.inserted.map((r) => r.name)).toEqual(["Run 0", "Run 40"]);
  });

  it("skips a workout that is already in the history and reports it", async () => {
    await run({ origin: "strava", kind: "easy" }, [file("a.gpx", gpx(0))]);
    const key = state.inserted[0]!.external_id as string;
    state.existing.add(key);
    state.inserted = [];
    const out = await run({ origin: "mapmyrun", kind: "easy" }, [file("a2.gpx", gpx(0))]);
    expect(state.inserted).toHaveLength(0);
    expect(out).toContain("0 imported, 1 already in your history");
    expect(out.startsWith("REDIRECT:/running?error=")).toBe(true);
  });

  it("keeps going when one file is bad and reports why", async () => {
    const out = await run({ origin: "strava", kind: "easy" }, [
      file("bad.fit", "xx"),
      file("html.gpx", "<html></html>"),
      file("ok.gpx", gpx(0)),
    ]);
    expect(state.inserted).toHaveLength(1);
    expect(out).toContain("1 imported");
    expect(out).toContain("2 failed");
    expect(out).toContain("bad.fit: FIT files are not supported");
    expect(out).toContain("html.gpx: Not a GPX or TCX file.");
  });

  it("reports a save failure instead of claiming success", async () => {
    state.failInsert = true;
    const out = await run({ origin: "strava", kind: "easy" }, [file("a.gpx", gpx(0))]);
    expect(out).toContain("0 imported");
    expect(out).toContain("a.gpx: could not save");
  });

  it("rejects more than 20 files and uploads over 4 MB", async () => {
    const many = Array.from({ length: 21 }, (_, i) => file(`${i}.gpx`, "x"));
    expect(await run({ origin: "strava", kind: "easy" }, many)).toContain("at most 20");
    const big = file("big.gpx", "x".repeat(4_000_001));
    expect(await run({ origin: "strava", kind: "easy" }, [big])).toContain("more than 4 MB");
  });

  it("rejects an unknown origin", async () => {
    expect(await run({ origin: "fitbit", kind: "easy" }, [file("a.gpx", gpx(0))])).toContain(
      "REDIRECT:/running?error=",
    );
    expect(state.inserted).toHaveLength(0);
  });
});
