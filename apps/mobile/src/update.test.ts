import { describe, expect, it } from "vitest";
import { currentBuild, decide, parseBuild, pickLatest } from "./update";

const url = (n: number) =>
  `https://github.com/jamesking-23/kkinggai/releases/download/android-${n}/kkingg-ai.apk`;
const rel = (n: number, extra: Record<string, unknown> = {}) => ({
  tag_name: `android-${n}`,
  name: `Build ${n}`,
  assets: [{ name: "kkingg-ai.apk", browser_download_url: url(n) }],
  ...extra,
});

describe("update helpers", () => {
  it("parses build tags", () => {
    expect(parseBuild("android-42")).toBe(42);
    for (const bad of ["v1", "android-", "android-1x", "desktop-v1", 5, null])
      expect(parseBuild(bad)).toBeNull();
  });
  it("picks the highest build, not the first listed", () => {
    expect(pickLatest([rel(3), rel(9), rel(5)])?.build).toBe(9);
  });
  it("skips drafts, prereleases, other tags and releases without an APK", () => {
    expect(pickLatest([rel(9, { draft: true }), rel(8, { prerelease: true })])).toBeNull();
    expect(pickLatest([{ tag_name: "desktop-v1", assets: [] }])).toBeNull();
    expect(
      pickLatest([rel(4, { assets: [{ name: "notes.txt", browser_download_url: url(4) }] })]),
    ).toBeNull();
  });
  it("refuses an APK link outside this repository's release downloads", () => {
    const evil = rel(9, {
      assets: [{ name: "x.apk", browser_download_url: "https://evil.example/x.apk" }],
    });
    expect(pickLatest([evil])).toBeNull();
    expect(pickLatest([evil, rel(2)])?.build).toBe(2);
  });
  it("tolerates garbage input", () => {
    expect(pickLatest(null)).toBeNull();
    expect(pickLatest({})).toBeNull();
    expect(pickLatest([null, 3, "x"])).toBeNull();
  });
  it("reads the current build", () => {
    expect(currentBuild("12")).toBe(12);
    for (const bad of [undefined, "", "abc", "-3", "1.5", "0"]) expect(currentBuild(bad)).toBe(0);
  });
  it("decides what to show", () => {
    const latest = pickLatest([rel(10)]);
    expect(decide(7, latest)).toEqual({ kind: "available", release: latest });
    expect(decide(10, latest)).toEqual({ kind: "current", build: 10 });
    expect(decide(12, latest).kind).toBe("current");
    expect(decide(0, latest).kind).toBe("current"); // development build
    expect(decide(7, null)).toEqual({ kind: "unknown" });
  });
});
