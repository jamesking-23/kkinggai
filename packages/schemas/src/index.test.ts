import { describe, expect, it } from "vitest";
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "./index";

describe("auth schemas", () => {
  it("normalises email on login", () => {
    const r = loginSchema.parse({ email: "  A@Example.COM ", password: "x" });
    expect(r.email).toBe("a@example.com");
  });

  it("rejects weak registration passwords", () => {
    const base = { displayName: "Ann", email: "a@b.co" };
    expect(registerSchema.safeParse({ ...base, password: "short1" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password: "onlyletterslong" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password: "longenough123" }).success).toBe(true);
  });

  it("requires matching passwords on reset", () => {
    expect(
      resetPasswordSchema.safeParse({ password: "longenough123", confirm: "nope" }).success,
    ).toBe(false);
    expect(
      resetPasswordSchema.safeParse({ password: "longenough123", confirm: "longenough123" })
        .success,
    ).toBe(true);
  });

  it("validates profile name and time zone", async () => {
    const { profileSchema } = await import("./index");
    expect(
      profileSchema.safeParse({ displayName: "Ann", timezone: "Africa/Kampala" }).success,
    ).toBe(true);
    expect(profileSchema.safeParse({ displayName: " ", timezone: "UTC" }).success).toBe(false);
    expect(profileSchema.safeParse({ displayName: "Ann", timezone: "Mars/Base" }).success).toBe(
      false,
    );
  });

  it("rejects invalid email for forgot password", () => {
    expect(forgotPasswordSchema.safeParse({ email: "nope" }).success).toBe(false);
  });
});

import { eventSchema, goalSchema, habitSchema, taskSchema } from "./index";

describe("productivity schemas", () => {
  it("treats blank optional fields as missing", () => {
    const t = taskSchema.parse({
      title: " Write report ",
      priority: "1",
      dueDate: "",
      projectId: "",
      category: "",
    });
    expect(t).toEqual({ title: "Write report", priority: 1 });
  });

  it("rejects bad priority, dates and project ids", () => {
    expect(taskSchema.safeParse({ title: "x", priority: "9" }).success).toBe(false);
    expect(taskSchema.safeParse({ title: "x", dueDate: "tomorrow" }).success).toBe(false);
    expect(taskSchema.safeParse({ title: "x", projectId: "nope" }).success).toBe(false);
  });

  it("requires a positive goal target when given", () => {
    expect(goalSchema.safeParse({ title: "Run", targetValue: "0" }).success).toBe(false);
    expect(goalSchema.parse({ title: "Run", targetValue: "100", unit: "km" }).targetValue).toBe(
      100,
    );
    expect(goalSchema.parse({ title: "Read" }).targetValue).toBeUndefined();
  });

  it("rejects events that end before they start", () => {
    const base = { title: "Meet", startsAt: "2026-11-07T10:00" };
    expect(eventSchema.safeParse({ ...base, endsAt: "2026-11-07T09:00" }).success).toBe(false);
    expect(eventSchema.safeParse({ ...base, endsAt: "2026-11-07T11:00" }).success).toBe(true);
  });

  it("defaults habit cadence", () => {
    expect(habitSchema.parse({ name: "Run" })).toEqual({
      name: "Run",
      cadence: "daily",
      targetPerPeriod: 1,
    });
  });
});

import { ideaSchema, ideaStatusSchema } from "./index";

describe("idea schemas", () => {
  it("accepts a minimal idea and applies defaults", () => {
    expect(ideaSchema.parse({ title: " Dark mode ", description: "", relatedModule: "" })).toEqual({
      title: "Dark mode",
      priority: 3,
    });
  });

  it("rejects empty titles and malformed module ids", () => {
    expect(ideaSchema.safeParse({ title: " " }).success).toBe(false);
    expect(ideaSchema.safeParse({ title: "x", relatedModule: "Bad Module" }).success).toBe(false);
  });

  it("only allows known statuses", () => {
    const id = "6f1c1c1e-5a45-4f4e-9c7e-3a0b8d6f2a11";
    expect(ideaStatusSchema.safeParse({ id, status: "planned" }).success).toBe(true);
    expect(ideaStatusSchema.safeParse({ id, status: "bogus" }).success).toBe(false);
  });
});

import {
  vaultLinkSchema,
  vaultNoteSchema,
  milestoneSchema,
  reminderSchema,
  subtaskSchema,
  taskEditSchema,
} from "./index";

describe("task detail schemas", () => {
  const id = "6f1c1c1e-5a45-4f4e-9c7e-3a0b8d6f2a11";

  it("parses a task edit and treats blanks as cleared", () => {
    const t = taskEditSchema.parse({
      id,
      title: " Plan ",
      priority: "2",
      description: "",
      dueDate: "",
      projectId: "",
      category: "",
    });
    expect(t).toEqual({ id, title: "Plan", priority: 2 });
  });

  it("rejects invalid ids, empty titles and bad reminder times", () => {
    expect(taskEditSchema.safeParse({ id: "nope", title: "x", priority: "2" }).success).toBe(false);
    expect(subtaskSchema.safeParse({ parentId: id, title: " " }).success).toBe(false);
    expect(
      reminderSchema.safeParse({ taskId: id, message: "Call", remindAt: "tomorrow" }).success,
    ).toBe(false);
    expect(
      reminderSchema.safeParse({ taskId: id, message: "Call", remindAt: "2026-11-08T09:00" })
        .success,
    ).toBe(true);
  });

  it("allows milestones without a due date", () => {
    expect(milestoneSchema.parse({ goalId: id, title: "First 50 km", dueDate: "" })).toEqual({
      goalId: id,
      title: "First 50 km",
    });
  });
});

describe("vault schemas", () => {
  it("parses a note and splits tags", () => {
    const n = vaultNoteSchema.parse({
      title: " Passport scan ",
      body: "",
      category: "",
      tags: "id, travel,, ",
    });
    expect(n.title).toBe("Passport scan");
    expect(n.tags).toEqual(["id", "travel"]);
    expect(n.category).toBeUndefined();
  });

  it("only accepts http(s) links", () => {
    expect(vaultLinkSchema.safeParse({ title: "x", url: "https://example.com/a" }).success).toBe(
      true,
    );
    expect(vaultLinkSchema.safeParse({ title: "x", url: "javascript:alert(1)" }).success).toBe(
      false,
    );
    expect(vaultLinkSchema.safeParse({ title: "x", url: "not a url" }).success).toBe(false);
    expect(vaultNoteSchema.safeParse({ title: " " }).success).toBe(false);
  });
});
