import { describe, expect, it } from "vitest";
import { checkItem, filterVault, kindText, parseTags, sizeText, type VaultRow } from "./vault";

const v = (
  id: string,
  kind: VaultRow["kind"],
  title: string,
  tags: string[] = [],
  category: string | null = null,
): VaultRow => ({
  id,
  kind,
  title,
  body: "",
  url: null,
  category,
  tags,
  storage_path: null,
  size_bytes: null,
  created_at: "2026-11-24T00:00:00Z",
});

describe("vault", () => {
  it("filters by kind and text across title, category and tags", () => {
    const items = [
      v("a", "note", "Wifi", ["home"]),
      v("b", "link", "Docs", [], "Work"),
      v("c", "file", "Scan"),
    ];
    expect(filterVault(items, "note", "").map((i) => i.id)).toEqual(["a"]);
    expect(filterVault(items, "all", "work").map((i) => i.id)).toEqual(["b"]);
    expect(filterVault(items, "all", "HOME").map((i) => i.id)).toEqual(["a"]);
    expect(filterVault(items, "all", "").length).toBe(3);
  });

  it("parses tags", () => {
    expect(parseTags(" a, b ,,c ")).toEqual(["a", "b", "c"]);
    expect(parseTags("")).toEqual([]);
    expect(parseTags("x".repeat(31))).toMatch(/30/);
    expect(parseTags("a,".repeat(21))).toMatch(/20/);
  });

  it("validates notes and links", () => {
    expect(checkItem("note", " Wifi ", "pw", "", " Home ", "a,b")).toEqual({
      kind: "note",
      title: "Wifi",
      body: "pw",
      url: null,
      category: "Home",
      tags: ["a", "b"],
    });
    expect(checkItem("link", "Docs", "", "https://example.com/x", "", "")).toMatchObject({
      url: "https://example.com/x",
    });
    expect(checkItem("link", "Docs", "", "javascript:alert(1)", "", "")).toBe(
      "Links must start with http:// or https://",
    );
    expect(checkItem("note", " ", "", "", "", "")).toBe("Enter a title.");
    expect(checkItem("note", "x", "y".repeat(20001), "", "", "")).toMatch(/too long/);
  });

  it("formats sizes and kinds", () => {
    expect(sizeText(500)).toBe("500 B");
    expect(sizeText(2048)).toBe("2 KB");
    expect(sizeText(3 * 1024 * 1024)).toBe("3.0 MB");
    expect(sizeText(null)).toBe("");
    expect(kindText("file")).toBe("File");
  });
});
