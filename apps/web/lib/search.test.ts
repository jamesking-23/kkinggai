import { describe, expect, it } from "vitest";
import { cleanQuery, groupHits, type SearchHit } from "./search";

const hit = (kind: string, id: string): SearchHit => ({
  kind,
  id,
  title: id,
  snippet: "",
  href: "/",
});

describe("cleanQuery", () => {
  it("trims, caps length and rejects short queries", () => {
    expect(cleanQuery("  hello ")).toBe("hello");
    expect(cleanQuery("a")).toBeNull();
    expect(cleanQuery(" a ")).toBeNull();
    expect(cleanQuery(undefined)).toBeNull();
    expect(cleanQuery("x".repeat(300))).toHaveLength(100);
  });
});

describe("groupHits", () => {
  const hits = [hit("vault", "v1"), hit("task", "t1"), hit("task", "t2"), hit("mystery", "m1")];
  it("groups in a stable order and hides disabled modules and unknown kinds", () => {
    const g = groupHits(hits, new Set(["tasks", "vault"]));
    expect(g.map((x) => x.kind)).toEqual(["task", "vault"]);
    expect(g[0]!.hits).toHaveLength(2);
    expect(groupHits(hits, new Set(["tasks"])).map((x) => x.kind)).toEqual(["task"]);
    expect(groupHits(hits, new Set())).toEqual([]);
  });

  it("includes academics, flashcards and career kinds only when their modules are enabled", () => {
    const more = [
      hit("course", "c"),
      hit("card", "k"),
      hit("application", "a"),
      hit("portfolio", "p"),
    ];
    expect(groupHits(more, new Set(["academics", "career"])).map((g) => g.kind)).toEqual([
      "course",
      "application",
      "portfolio",
    ]);
    expect(groupHits(more, new Set(["flashcards"])).map((g) => g.kind)).toEqual(["card"]);
  });
});

import { highlight, intersectHits, MAX_TERMS, splitTerms } from "./search";

describe("splitTerms", () => {
  it("splits words and keeps quoted phrases whole", () => {
    expect(splitTerms("chess opening")).toEqual(["chess", "opening"]);
    expect(splitTerms('plan "sicilian defence" notes')).toEqual([
      "plan",
      "sicilian defence",
      "notes",
    ]);
  });
  it("drops short and duplicate terms and caps the count", () => {
    expect(splitTerms("a bb BB cc")).toEqual(["bb", "cc"]);
    expect(splitTerms("one two three four five six")).toHaveLength(MAX_TERMS);
    expect(splitTerms("   ")).toEqual([]);
  });
  it("tolerates an unbalanced quote", () => {
    expect(splitTerms('"open')).toEqual(["open"]);
  });
});

describe("intersectHits", () => {
  const h = (kind: string, id: string) => ({ kind, id, title: id, snippet: "", href: "/" });
  it("keeps hits present in every list, in first-list order", () => {
    const a = [h("task", "1"), h("task", "2"), h("goal", "1")];
    const b = [h("goal", "1"), h("task", "2")];
    expect(intersectHits([a, b]).map((x) => `${x.kind}${x.id}`)).toEqual(["task2", "goal1"]);
  });
  it("treats the same id under another kind as different", () => {
    expect(intersectHits([[h("task", "1")], [h("goal", "1")]])).toEqual([]);
  });
  it("handles one list and none", () => {
    expect(intersectHits([[h("task", "1")]])).toHaveLength(1);
    expect(intersectHits([])).toEqual([]);
  });
});

describe("highlight", () => {
  it("marks matches case-insensitively", () => {
    expect(highlight("Fix the Chess board", ["chess"])).toEqual([
      { text: "Fix the ", match: false },
      { text: "Chess", match: true },
      { text: " board", match: false },
    ]);
  });
  it("is safe with regex characters and no terms", () => {
    expect(highlight("cost (usd) $5", ["(usd)", "$5"]).filter((s) => s.match)).toHaveLength(2);
    expect(highlight("plain", [])).toEqual([{ text: "plain", match: false }]);
    expect(highlight("", ["x"])).toEqual([{ text: "", match: false }]);
  });
});
