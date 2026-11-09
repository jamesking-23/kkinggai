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
});
