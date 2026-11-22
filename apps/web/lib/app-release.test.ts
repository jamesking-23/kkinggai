import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchLatestRelease, parseBuild, pickLatest } from "./app-release";

const url = (n: number) =>
  `https://github.com/jamesking-23/kkinggai/releases/download/android-${n}/kkingg-ai.apk`;
const rel = (n: number, extra: Record<string, unknown> = {}) => ({
  tag_name: `android-${n}`,
  assets: [{ name: "kkingg-ai.apk", browser_download_url: url(n), size: 1000 + n }],
  ...extra,
});

afterEach(() => vi.unstubAllGlobals());

describe("app release lookup", () => {
  it("parses tags", () => {
    expect(parseBuild("android-12")).toBe(12);
    for (const bad of ["android-", "v1", "android-1x", 3, null]) expect(parseBuild(bad)).toBeNull();
  });
  it("picks the highest build with its size", () => {
    expect(pickLatest([rel(3), rel(9), rel(5)])).toEqual({ build: 9, url: url(9), size: 1009 });
  });
  it("skips drafts, prereleases, other tags, non-apk assets", () => {
    expect(pickLatest([rel(9, { draft: true }), rel(8, { prerelease: true })])).toBeNull();
    expect(pickLatest([{ tag_name: "desktop-v1", assets: [] }])).toBeNull();
    expect(
      pickLatest([rel(4, { assets: [{ name: "n.txt", browser_download_url: url(4) }] })]),
    ).toBeNull();
  });
  it("refuses an APK link outside this repository's release downloads", () => {
    const evil = rel(9, {
      assets: [{ name: "x.apk", browser_download_url: "https://evil.example/x.apk" }],
    });
    expect(pickLatest([evil])).toBeNull();
    expect(pickLatest([evil, rel(2)])?.build).toBe(2);
  });
  it("tolerates garbage", () => {
    for (const g of [null, {}, [null, 3, "x"]]) expect(pickLatest(g)).toBeNull();
  });
  it("fetches and returns the newest, and returns null on failure", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => [rel(2), rel(7)] }));
    expect((await fetchLatestRelease())?.build).toBe(7);
    vi.stubGlobal("fetch", async () => ({ ok: false }));
    expect(await fetchLatestRelease()).toBeNull();
    vi.stubGlobal("fetch", async () => {
      throw new Error("down");
    });
    expect(await fetchLatestRelease()).toBeNull();
  });
});
