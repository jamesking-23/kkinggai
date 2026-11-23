import { describe, expect, it } from "vitest";
import {
  checkProject,
  nextStatuses,
  openCounts,
  parseDueDate,
  sortProjects,
  statusLabel,
  type ProjectRow,
} from "./projects";

const p = (id: string, status: ProjectRow["status"], due: string | null): ProjectRow => ({
  id,
  name: id,
  description: "",
  status,
  due_date: due,
  revision: 1,
});

describe("projects", () => {
  it("sorts by status then due date and hides archived", () => {
    const out = sortProjects([
      p("done", "completed", null),
      p("late", "active", "2026-12-30"),
      p("none", "active", null),
      p("soon", "active", "2026-12-01"),
      p("gone", "archived", null),
      p("hold", "paused", null),
    ]);
    expect(out.map((x) => x.id)).toEqual(["soon", "late", "none", "hold", "done"]);
  });

  it("offers sensible status moves", () => {
    expect(nextStatuses("active")).toEqual(["paused", "completed", "archived"]);
    expect(nextStatuses("completed")).toEqual(["active", "archived"]);
    expect(statusLabel("paused")).toBe("Paused");
  });

  it("counts open tasks per project", () => {
    const m = openCounts([{ project_id: "a" }, { project_id: "a" }, { project_id: null }]);
    expect(m.get("a")).toBe(2);
    expect(m.size).toBe(1);
  });

  it("parses due dates", () => {
    expect(parseDueDate("2026-12-01")).toBe("2026-12-01");
    expect(parseDueDate("2026-02-30")).toBeNull();
    expect(parseDueDate("1/2/2026")).toBeNull();
  });

  it("validates a new project", () => {
    expect(checkProject(" App ", " x ", "")).toEqual({ name: "App", description: "x", due: null });
    expect(checkProject("App", "", "2026-12-01")).toEqual({
      name: "App",
      description: "",
      due: "2026-12-01",
    });
    expect(checkProject(" ", "", "")).toBe("Enter a project name.");
    expect(checkProject("App", "", "tomorrow")).toMatch(/YYYY-MM-DD/);
    expect(checkProject("x".repeat(201), "", "")).toMatch(/too long/);
  });
});
