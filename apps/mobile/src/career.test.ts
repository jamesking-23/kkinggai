import { describe, expect, it } from "vitest";
import {
  cleanLine,
  dueSoon,
  filterApplications,
  isStatus,
  pipelineCounts,
  statusLabel,
  statusPatch,
} from "./career";

const a = (
  id: string,
  status: string,
  deadline: string | null,
  company = "Acme",
  role = "Engineer",
) => ({ id, status, deadline, company, role });

describe("career helpers", () => {
  it("validates and labels statuses", () => {
    expect(isStatus("offer")).toBe(true);
    for (const bad of ["Offer", "", "ghosted", 3, null]) expect(isStatus(bad)).toBe(false);
    expect(statusLabel("interviewing")).toBe("Interviewing");
  });
  it("counts the pipeline including zeros, in order", () => {
    const c = pipelineCounts([
      a("1", "applied", null),
      a("2", "applied", null),
      a("3", "offer", null),
    ]);
    expect(c.map((x) => x.status)).toEqual([
      "wishlist",
      "applied",
      "interviewing",
      "offer",
      "rejected",
      "withdrawn",
    ]);
    expect(c.map((x) => x.count)).toEqual([0, 2, 0, 1, 0, 0]);
  });
  it("lists open applications due within 14 days, soonest first", () => {
    const today = "2026-11-23";
    const list = dueSoon(
      [
        a("far", "applied", "2026-12-20"),
        a("late", "wishlist", "2026-12-07"),
        a("soon", "interviewing", "2026-11-25"),
        a("past", "applied", "2026-11-22"),
        a("closed", "rejected", "2026-11-24"),
        a("none", "applied", null),
        a("today", "applied", "2026-11-23"),
      ],
      today,
    );
    expect(list.map((x) => x.id)).toEqual(["today", "soon", "late"]);
  });
  it("stamps the applied date only when missing", () => {
    expect(statusPatch("applied", false, "2026-11-23")).toEqual({
      status: "applied",
      applied_on: "2026-11-23",
    });
    expect(statusPatch("applied", true, "2026-11-23")).toEqual({ status: "applied" });
    expect(statusPatch("offer", false, "2026-11-23")).toEqual({ status: "offer" });
  });
  it("cleans text", () => {
    expect(cleanLine("  Acme   Ltd ")).toBe("Acme Ltd");
    expect(cleanLine("  ")).toBeNull();
    expect(cleanLine("x".repeat(300))).toHaveLength(200);
  });
  it("filters by status and text", () => {
    const list = [
      a("1", "applied", null, "Acme", "Site Engineer"),
      a("2", "offer", null, "Beta", "Surveyor"),
    ];
    expect(filterApplications(list, "all", "")).toHaveLength(2);
    expect(filterApplications(list, "offer", "").map((x) => x.id)).toEqual(["2"]);
    expect(filterApplications(list, "all", "SITE").map((x) => x.id)).toEqual(["1"]);
    expect(filterApplications(list, "applied", "beta")).toEqual([]);
  });
});
