import { describe, expect, it } from "vitest";
import { stars, summarise } from "./media";

describe("summarise", () => {
  const rows = [
    { kind: "book", status: "done", rating: 5, finished_on: "2026-03-01" },
    { kind: "book", status: "done", rating: 4, finished_on: "2025-12-31" },
    { kind: "movie", status: "done", rating: null, finished_on: "2026-05-05" },
    { kind: "game", status: "in_progress", rating: null, finished_on: null },
    { kind: "show", status: "wishlist", rating: 3, finished_on: null },
    { kind: "show", status: "dropped", rating: null, finished_on: null },
  ];
  it("counts statuses and this year's finished items by kind", () => {
    const s = summarise(rows, "2026");
    expect(s.byStatus).toEqual({ wishlist: 1, in_progress: 1, done: 3, dropped: 1 });
    expect(s.doneThisYear).toEqual({ book: 1, movie: 1 });
  });
  it("averages only ratings on finished items", () => {
    expect(summarise(rows, "2026").averageRating).toBe(4.5);
    expect(summarise([], "2026").averageRating).toBeNull();
  });
});

describe("stars", () => {
  it("renders filled and empty stars", () => {
    expect(stars(4)).toBe("★★★★☆");
    expect(stars(null)).toBe("");
  });
});
