import { describe, expect, it } from "vitest";
import {
  checkMedia,
  filterMedia,
  kindLabel,
  stars,
  statusCounts,
  statusLabel,
  statusPatch,
  type MediaRow,
} from "./media";

const m = (
  id: string,
  kind: MediaRow["kind"],
  status: MediaRow["status"],
  title = id,
): MediaRow => ({
  id,
  kind,
  title,
  creator: null,
  status,
  rating: null,
  finished_on: null,
  notes: "",
  revision: 1,
});

describe("media", () => {
  it("labels kinds and statuses", () => {
    expect(kindLabel("movie")).toBe("Film");
    expect(kindLabel("book")).toBe("Book");
    expect(statusLabel("in_progress")).toBe("In progress");
  });

  it("counts statuses including zeros", () => {
    const c = statusCounts([m("a", "book", "done"), m("b", "game", "done")]);
    expect(c.find((x) => x.status === "done")?.count).toBe(2);
    expect(c.find((x) => x.status === "dropped")?.count).toBe(0);
  });

  it("filters by status, kind and text", () => {
    const items = [
      { ...m("a", "book", "done", "Dune"), creator: "Herbert" },
      m("b", "movie", "wishlist", "Dune 2"),
      m("c", "book", "wishlist", "Emma"),
    ];
    expect(filterMedia(items, "all", "all", "dune").map((i) => i.id)).toEqual(["a", "b"]);
    expect(filterMedia(items, "wishlist", "book", "").map((i) => i.id)).toEqual(["c"]);
    expect(filterMedia(items, "all", "all", "herbert").map((i) => i.id)).toEqual(["a"]);
  });

  it("validates new items", () => {
    expect(checkMedia(" Dune ", " Herbert ")).toEqual({ title: "Dune", creator: "Herbert" });
    expect(checkMedia("Dune", " ")).toEqual({ title: "Dune", creator: null });
    expect(checkMedia(" ", "")).toBe("Enter a title.");
    expect(checkMedia("x".repeat(201), "")).toMatch(/too long/);
  });

  it("builds status updates", () => {
    expect(statusPatch({ finished_on: null }, "done", 4, "2026-11-24")).toEqual({
      status: "done",
      rating: 4,
      finished_on: "2026-11-24",
    });
    expect(statusPatch({ finished_on: "2026-01-01" }, "done", null, "2026-11-24")).toEqual({
      status: "done",
    });
    expect(statusPatch({ finished_on: null }, "in_progress", 9, "2026-11-24")).toEqual({
      status: "in_progress",
    });
  });

  it("draws stars", () => {
    expect(stars(3)).toBe("★★★☆☆");
    expect(stars(null)).toBe("");
  });
});
