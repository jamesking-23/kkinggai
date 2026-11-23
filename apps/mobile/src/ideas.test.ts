import { describe, expect, it } from "vitest";
import {
  cleanNote,
  cleanTitle,
  filterIdeas,
  priorityText,
  sortIdeas,
  statusCounts,
  statusText,
  type IdeaRow,
} from "./ideas";

const idea = (id: string, over: Partial<IdeaRow> = {}): IdeaRow => ({
  id,
  title: id,
  description: "",
  category: null,
  priority: 3,
  status: "captured",
  revision: 1,
  created_at: "2026-11-01T00:00:00Z",
  ...over,
});

describe("idea helpers", () => {
  it("words statuses and priorities", () => {
    expect(statusText("in_development")).toBe("In development");
    expect(statusText("captured")).toBe("Captured");
    expect(priorityText(1)).toBe("Urgent");
    expect(priorityText(4)).toBe("Low");
    expect(priorityText(99)).toBe("Normal");
  });
  it("counts per status including zeros", () => {
    const c = statusCounts([idea("a"), idea("b", { status: "planned" }), idea("c")]);
    expect(c.map((x) => x.count)).toEqual([2, 1, 0, 0, 0, 0]);
    expect(c[0]!.status).toBe("captured");
  });
  it("sorts by priority then newest", () => {
    const s = sortIdeas([
      idea("old3", { created_at: "2026-10-01T00:00:00Z" }),
      idea("new3", { created_at: "2026-11-20T00:00:00Z" }),
      idea("urgent", { priority: 1, created_at: "2026-09-01T00:00:00Z" }),
    ]);
    expect(s.map((x) => x.id)).toEqual(["urgent", "new3", "old3"]);
  });
  it("filters by status and text across title, note and category", () => {
    const list = [
      idea("Solar charger", { category: "hardware" }),
      idea("Blog", { status: "planned", description: "write about solar" }),
    ];
    expect(filterIdeas(list, "all", "")).toHaveLength(2);
    expect(filterIdeas(list, "planned", "")).toHaveLength(1);
    expect(filterIdeas(list, "all", "SOLAR")).toHaveLength(2);
    expect(filterIdeas(list, "all", "hardw")).toHaveLength(1);
    expect(filterIdeas(list, "active", "")).toHaveLength(0);
  });
  it("cleans input", () => {
    expect(cleanTitle("  A   big  idea ")).toBe("A big idea");
    expect(cleanTitle("   ")).toBeNull();
    expect(cleanTitle("x".repeat(300))).toHaveLength(200);
    expect(cleanNote("  line1\nline2  ")).toBe("line1\nline2");
    expect(cleanNote("x".repeat(5000))).toHaveLength(4000);
  });
});
