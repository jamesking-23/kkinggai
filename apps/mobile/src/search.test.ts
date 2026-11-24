import { describe, expect, it } from "vitest";
import {
  cleanQuery,
  groupHits,
  highlight,
  intersectHits,
  routeFor,
  splitTerms,
  type SearchHit,
} from "./search";

const h = (kind: string, id: string): SearchHit => ({
  kind,
  id,
  title: id,
  snippet: "",
  href: "/x",
});

describe("search", () => {
  it("cleans queries", () => {
    expect(cleanQuery(" ab ")).toBe("ab");
    expect(cleanQuery("a")).toBeNull();
    expect(cleanQuery(undefined)).toBeNull();
    expect(cleanQuery("x".repeat(150))?.length).toBe(100);
  });

  it("splits words and quoted phrases", () => {
    expect(splitTerms('red "big dog" red a')).toEqual(["red", "big dog"]);
    expect(splitTerms("one two three four five")).toHaveLength(4);
  });

  it("keeps only hits found for every word", () => {
    const out = intersectHits([[h("task", "1"), h("task", "2")], [h("task", "2")]]);
    expect(out.map((x) => x.id)).toEqual(["2"]);
    expect(intersectHits([])).toEqual([]);
  });

  it("groups by kind and drops disabled modules", () => {
    const groups = groupHits(
      [h("task", "1"), h("goal", "2"), h("mystery", "3")],
      new Set(["tasks"]),
    );
    expect(groups.map((g) => g.kind)).toEqual(["task"]);
  });

  it("routes paths to native screens, the Tasks tab or the website", () => {
    expect(routeFor("/ideas")).toEqual({ type: "screen", screen: "ideas" });
    expect(routeFor("/tasks/abc-123")).toEqual({ type: "tab", tab: "tasks" });
    expect(routeFor("/chess/games/7?x=1")).toEqual({ type: "screen", screen: "chess" });
    expect(routeFor("/settings")).toEqual({ type: "screen", screen: "settings" });
    expect(routeFor("/settings/modules")).toEqual({ type: "screen", screen: "settings" });
    expect(routeFor("/assistant")).toEqual({ type: "web", path: "/assistant" });
    expect(routeFor("/")).toEqual({ type: "web", path: "/" });
  });

  it("highlights matches", () => {
    expect(highlight("Red dog", ["red"])).toEqual([
      { text: "Red", match: true },
      { text: " dog", match: false },
    ]);
    expect(highlight("a.b", ["."])).toEqual([
      { text: "a", match: false },
      { text: ".", match: true },
      { text: "b", match: false },
    ]);
  });
});
