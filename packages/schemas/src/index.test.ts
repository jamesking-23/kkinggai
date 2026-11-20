import { describe, expect, it } from "vitest";
import {
  feedSchema,
  forgotPasswordSchema,
  importantDateSchema,
  journalSchema,
  loginSchema,
  mediaSchema,
  mediaStatusSchema,
  newsItemStateSchema,
  notificationReadSchema,
  registerSchema,
  resetPasswordSchema,
  ventureContactSchema,
  ventureEntrySchema,
  ventureSchema,
  ventureTaskSchema,
  ventureTaskStatusSchema,
} from "./index";

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
  researchSourceSchema,
  researchStatusSchema,
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

describe("research schemas", () => {
  const id = "6f1c1c1e-5a45-4f4e-9c7e-3a0b8d6f2a11";
  it("parses a source, defaults the kind and rejects bad years and links", () => {
    const s = researchSourceSchema.parse({
      title: " Load paths ",
      authors: "",
      publishedYear: "2021",
      tags: "a, b",
      url: "",
    });
    expect(s).toMatchObject({
      title: "Load paths",
      publishedYear: 2021,
      kind: "article",
      tags: ["a", "b"],
    });
    expect(researchSourceSchema.safeParse({ title: "x", publishedYear: "5" }).success).toBe(false);
    expect(researchSourceSchema.safeParse({ title: "x", url: "ftp://x.org" }).success).toBe(false);
    expect(researchSourceSchema.safeParse({ title: "x", publishedYear: "" }).success).toBe(true);
  });
  it("validates reading status", () => {
    expect(researchStatusSchema.safeParse({ id, status: "reading" }).success).toBe(true);
    expect(researchStatusSchema.safeParse({ id, status: "done" }).success).toBe(false);
  });
});

describe("venture schemas", () => {
  it("normalises currency and defaults the stage", () => {
    const v = ventureSchema.parse({ name: " Poultry ", currency: "ugx", website: "" });
    expect(v).toMatchObject({ name: "Poultry", currency: "UGX", stage: "idea" });
    expect(ventureSchema.safeParse({ name: "x", currency: "UG" }).success).toBe(false);
    expect(ventureSchema.safeParse({ name: "x", website: "javascript:alert(1)" }).success).toBe(
      false,
    );
  });
  it("validates entry amounts", () => {
    const base = { ventureId: "00000000-0000-4000-8000-000000000000", kind: "income" };
    expect(ventureEntrySchema.parse({ ...base, amount: "1,500.50" }).amount).toBe(1500.5);
    expect(ventureEntrySchema.safeParse({ ...base, amount: "0" }).success).toBe(false);
    expect(ventureEntrySchema.safeParse({ ...base, amount: "1.234" }).success).toBe(false);
    expect(ventureEntrySchema.safeParse({ ...base, amount: "abc" }).success).toBe(false);
    expect(ventureEntrySchema.safeParse({ ...base, kind: "gift", amount: 1 }).success).toBe(false);
  });
});

describe("venture contact and task schemas", () => {
  const ventureId = "00000000-0000-4000-8000-000000000000";
  it("validates contacts", () => {
    expect(ventureContactSchema.parse({ ventureId, name: " Ann ", email: "" })).toMatchObject({
      name: "Ann",
      role: "other",
    });
    expect(ventureContactSchema.safeParse({ ventureId, name: "x", email: "nope" }).success).toBe(
      false,
    );
    expect(ventureContactSchema.safeParse({ ventureId, name: "x", role: "boss" }).success).toBe(
      false,
    );
  });
  it("validates tasks and status changes", () => {
    expect(ventureTaskSchema.safeParse({ ventureId, title: "" }).success).toBe(false);
    expect(
      ventureTaskSchema.parse({ ventureId, title: "Register", dueOn: "" }).dueOn,
    ).toBeUndefined();
    expect(
      ventureTaskStatusSchema.safeParse({ id: ventureId, ventureId, status: "blocked" }).success,
    ).toBe(false);
  });
});

describe("personal schemas", () => {
  it("parses journal tags and optional mood", () => {
    const j = journalSchema.parse({
      entryDate: "2026-11-17",
      body: " hi ",
      tags: "Run, Family ,",
      mood: "",
    });
    expect(j).toMatchObject({ body: "hi", tags: ["run", "family"] });
    expect(j.mood).toBeUndefined();
    expect(journalSchema.safeParse({ entryDate: "2026-11-17", body: "  " }).success).toBe(false);
    expect(journalSchema.safeParse({ entryDate: "2026-11-17", body: "x", mood: "6" }).success).toBe(
      false,
    );
  });
  it("rejects dates that do not exist", () => {
    expect(importantDateSchema.safeParse({ title: "x", month: "2", day: "30" }).success).toBe(
      false,
    );
    expect(importantDateSchema.safeParse({ title: "x", month: "2", day: "29" }).success).toBe(true);
    expect(
      importantDateSchema.safeParse({ title: "x", month: "2", day: "29", year: "2027" }).success,
    ).toBe(false);
    expect(importantDateSchema.safeParse({ title: "x", month: "13", day: "1" }).success).toBe(
      false,
    );
  });
});

describe("news schemas", () => {
  it("accepts only http(s) feed addresses", () => {
    expect(
      feedSchema.parse({ url: " https://example.com/feed.xml ", topic: "" }).topic,
    ).toBeUndefined();
    expect(feedSchema.safeParse({ url: "ftp://example.com/f" }).success).toBe(false);
    expect(feedSchema.safeParse({ url: "javascript:alert(1)" }).success).toBe(false);
    expect(feedSchema.safeParse({ url: "not a url" }).success).toBe(false);
  });
  it("validates item state changes", () => {
    const id = "00000000-0000-4000-8000-000000000000";
    expect(newsItemStateSchema.safeParse({ id, read: "1" }).success).toBe(true);
    expect(newsItemStateSchema.safeParse({ id, saved: "yes" }).success).toBe(false);
  });
});

describe("media schemas", () => {
  it("parses a media item with tags and optional fields", () => {
    const m = mediaSchema.parse({
      kind: "book",
      title: " Dune ",
      tags: "SciFi, classic",
      rating: "",
      startedOn: "",
    });
    expect(m).toMatchObject({ title: "Dune", status: "wishlist", tags: ["scifi", "classic"] });
    expect(m.rating).toBeUndefined();
  });
  it("rejects bad kinds, ratings and date order", () => {
    expect(mediaSchema.safeParse({ kind: "painting", title: "x" }).success).toBe(false);
    expect(mediaSchema.safeParse({ kind: "book", title: "x", rating: "6" }).success).toBe(false);
    expect(
      mediaSchema.safeParse({
        kind: "book",
        title: "x",
        startedOn: "2026-02-01",
        finishedOn: "2026-01-01",
      }).success,
    ).toBe(false);
  });
  it("validates status updates", () => {
    const id = "00000000-0000-4000-8000-000000000000";
    expect(mediaStatusSchema.parse({ id, status: "done", rating: "4" }).rating).toBe(4);
    expect(mediaStatusSchema.safeParse({ id, status: "finished" }).success).toBe(false);
  });
});

describe("notification schema", () => {
  it("requires a uuid", () => {
    expect(
      notificationReadSchema.safeParse({ id: "00000000-0000-4000-8000-000000000000" }).success,
    ).toBe(true);
    expect(notificationReadSchema.safeParse({ id: "nope" }).success).toBe(false);
  });
});

describe("task repeat", () => {
  it("accepts the five repeat choices and treats blank as none", () => {
    for (const repeat of ["daily", "weekdays", "weekly", "monthly", "yearly"]) {
      expect(taskSchema.safeParse({ title: "x", repeat }).success).toBe(true);
    }
    const blank = taskSchema.safeParse({ title: "x", repeat: "" });
    expect(blank.success && blank.data.repeat).toBeUndefined();
  });
  it("rejects anything else, in both task schemas", () => {
    expect(taskSchema.safeParse({ title: "x", repeat: "hourly" }).success).toBe(false);
    expect(
      taskEditSchema.safeParse({
        id: "11111111-1111-4111-8111-111111111111",
        title: "x",
        priority: 2,
        repeat: "FREQ=SECONDLY",
      }).success,
    ).toBe(false);
  });
});

describe("task attachment limits", () => {
  it("shares the vault limit and drops legacy .doc", async () => {
    const m = await import("./index");
    expect(m.TASK_FILE_MAX_BYTES).toBe(m.VAULT_MAX_UPLOAD_BYTES);
    expect(m.TASK_FILE_MIME_TYPES).not.toContain("application/msword");
    expect(m.TASK_FILE_MIME_TYPES).toContain("application/pdf");
  });
});

describe("chessAnalysisSaveSchema", () => {
  const good = {
    gameId: "11111111-1111-4111-8111-111111111111",
    depth: 14,
    evals: [{ white: 20, bestUci: "e2e4", bestSan: "e4", depth: 14 }],
  };
  it("accepts a well-formed analysis", async () => {
    const { chessAnalysisSaveSchema } = await import("./index");
    expect(chessAnalysisSaveSchema.safeParse(good).success).toBe(true);
  });
  it("rejects bad shapes", async () => {
    const { chessAnalysisSaveSchema } = await import("./index");
    const bad = (patch: object) => chessAnalysisSaveSchema.safeParse({ ...good, ...patch }).success;
    expect(bad({ evals: [] })).toBe(false);
    expect(bad({ depth: 99 })).toBe(false);
    expect(bad({ evals: [{ ...good.evals[0], bestUci: "zz" }] })).toBe(false);
    expect(bad({ evals: [{ ...good.evals[0], white: 99999 }] })).toBe(false);
    expect(bad({ gameId: "nope" })).toBe(false);
  });
});
