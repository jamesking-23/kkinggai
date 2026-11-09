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
  applicationSchema,
  applicationStatusSchema,
  careerProfileSchema,
  cvEntrySchema,
  interviewPrepSchema,
  portfolioSchema,
  assignmentSchema,
  assignmentUpdateSchema,
  cardReviewSchema,
  cardSchema,
  courseSchema,
  deckSchema,
  studyNoteSchema,
  assistantMessageSchema,
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

describe("assistant message schema", () => {
  it("trims, treats a blank conversation id as new and enforces limits", () => {
    expect(assistantMessageSchema.parse({ conversationId: "", message: "  hi " })).toEqual({
      message: "hi",
    });
    expect(assistantMessageSchema.safeParse({ message: "   " }).success).toBe(false);
    expect(assistantMessageSchema.safeParse({ message: "x".repeat(4001) }).success).toBe(false);
    expect(
      assistantMessageSchema.safeParse({ conversationId: "nope", message: "hi" }).success,
    ).toBe(false);
  });
});

describe("academics and flashcard schemas", () => {
  const id = "6f1c1c1e-5a45-4f4e-9c7e-3a0b8d6f2a11";

  it("parses a course with blank optionals", () => {
    expect(
      courseSchema.parse({
        name: " Structures ",
        code: "",
        term: "",
        instructor: "",
        credits: "3",
      }),
    ).toEqual({
      name: "Structures",
      credits: 3,
    });
    expect(courseSchema.safeParse({ name: "x", credits: "-1" }).success).toBe(false);
  });

  it("defaults assignment max score and rejects bad input", () => {
    const a = assignmentSchema.parse({
      courseId: id,
      title: "Lab 1",
      maxScore: "",
      dueDate: "",
      weightPercent: "",
    });
    expect(a.maxScore).toBe(100);
    expect(assignmentSchema.safeParse({ courseId: "nope", title: "x" }).success).toBe(false);
    expect(
      assignmentSchema.safeParse({ courseId: id, title: "x", weightPercent: "150" }).success,
    ).toBe(false);
  });

  it("does not let a score exceed the maximum", () => {
    const base = { id, status: "graded", maxScore: "50" };
    expect(assignmentUpdateSchema.safeParse({ ...base, score: "45" }).success).toBe(true);
    expect(assignmentUpdateSchema.safeParse({ ...base, score: "51" }).success).toBe(false);
    expect(assignmentUpdateSchema.safeParse({ ...base, status: "todo", score: "" }).success).toBe(
      true,
    );
    expect(assignmentUpdateSchema.safeParse({ ...base, status: "bogus" }).success).toBe(false);
  });

  it("validates notes, decks, cards and ratings", () => {
    expect(studyNoteSchema.parse({ title: "T", tags: "a, b" }).tags).toEqual(["a", "b"]);
    expect(deckSchema.parse({ name: "D", description: "", courseId: "" })).toEqual({ name: "D" });
    expect(cardSchema.safeParse({ deckId: id, front: " ", back: "a" }).success).toBe(false);
    expect(cardReviewSchema.safeParse({ id, rating: "3" }).success).toBe(true);
    expect(cardReviewSchema.safeParse({ id, rating: "4" }).success).toBe(false);
  });
});

describe("career schemas", () => {
  const id = "6f1c1c1e-5a45-4f4e-9c7e-3a0b8d6f2a11";

  it("parses a profile with blank fields and rejects non-http links", () => {
    expect(
      careerProfileSchema.parse({ headline: " Civil engineer ", summary: "", website: "" }),
    ).toEqual({
      headline: "Civil engineer",
    });
    expect(careerProfileSchema.safeParse({ website: "javascript:alert(1)" }).success).toBe(false);
    expect(
      careerProfileSchema.safeParse({ linkedinUrl: "https://linkedin.com/in/x" }).success,
    ).toBe(true);
  });

  it("requires CV entries to end after they start", () => {
    const ok = {
      kind: "experience",
      title: "Site engineer",
      startDate: "2024-01-01",
      endDate: "2024-06-30",
    };
    expect(cvEntrySchema.safeParse(ok).success).toBe(true);
    expect(cvEntrySchema.safeParse({ ...ok, endDate: "2023-12-31" }).success).toBe(false);
    expect(cvEntrySchema.safeParse({ ...ok, endDate: "" }).success).toBe(true);
    expect(cvEntrySchema.safeParse({ ...ok, kind: "hobby" }).success).toBe(false);
  });

  it("defaults application status and validates it", () => {
    expect(applicationSchema.parse({ company: " Acme ", role: "Graduate engineer" }).status).toBe(
      "wishlist",
    );
    expect(applicationSchema.safeParse({ company: "", role: "x" }).success).toBe(false);
    expect(applicationStatusSchema.safeParse({ id, status: "offer" }).success).toBe(true);
    expect(applicationStatusSchema.safeParse({ id, status: "hired" }).success).toBe(false);
  });

  it("validates interview prep and portfolio items", () => {
    const q = interviewPrepSchema.parse({ question: "Tell me about yourself", confidence: "4" });
    expect(q).toMatchObject({ category: "behavioural", confidence: 4 });
    expect(interviewPrepSchema.safeParse({ question: "q", confidence: "6" }).success).toBe(false);
    expect(portfolioSchema.parse({ title: "Bridge design", tags: "civil, design" }).tags).toEqual([
      "civil",
      "design",
    ]);
  });
});
