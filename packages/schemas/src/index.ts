import { z } from "zod";

const email = z.string().trim().toLowerCase().email("Enter a valid email address");
const password = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128, "Use at most 128 characters")
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), "Include at least one letter and one number");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password"),
});

export const registerSchema = z.object({
  displayName: z.string().trim().min(1, "Enter your name").max(80),
  email,
  password,
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const profileSchema = z.object({
  displayName: z.string().trim().min(1, "Enter your name").max(80, "Use at most 80 characters"),
  timezone: z.string().refine(isValidTimeZone, "Choose a valid time zone"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;

// ---------- productivity forms (FormData sends "" for blank inputs) ----------
const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optionalText = (max: number) => z.preprocess(blank, z.string().trim().max(max).optional());
const optionalDate = z.preprocess(
  blank,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date")
    .optional(),
);
const localDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Use a valid date and time");

export const taskSchema = z.object({
  title: z.string().trim().min(1, "Enter a task title").max(300),
  priority: z.coerce.number().int().min(1).max(4).default(3),
  dueDate: optionalDate,
  projectId: z.preprocess(blank, z.string().uuid().optional()),
  category: optionalText(60),
});

export const projectSchema = z.object({
  name: z.string().trim().min(1, "Enter a project name").max(200),
  description: optionalText(2000),
  dueDate: optionalDate,
});

export const goalSchema = z.object({
  title: z.string().trim().min(1, "Enter a goal title").max(200),
  targetValue: z.preprocess(
    blank,
    z.coerce.number().positive("Target must be above zero").optional(),
  ),
  unit: optionalText(30),
  deadline: optionalDate,
});

export const goalProgressSchema = z.object({
  id: z.string().uuid(),
  currentValue: z.coerce.number().min(0, "Progress cannot be negative"),
});

export const eventSchema = z
  .object({
    title: z.string().trim().min(1, "Enter an event title").max(300),
    startsAt: localDateTime,
    endsAt: localDateTime,
    location: optionalText(200),
  })
  .refine((v) => v.endsAt >= v.startsAt, {
    message: "End must not be before start",
    path: ["endsAt"],
  });

export const habitSchema = z.object({
  name: z.string().trim().min(1, "Enter a habit name").max(200),
  cadence: z.enum(["daily", "weekly"]).default("daily"),
  targetPerPeriod: z.coerce.number().int().min(1).max(14).default(1),
});

export const IDEA_STATUSES = [
  "captured",
  "planned",
  "in_development",
  "active",
  "experimental",
  "deprecated",
] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];

export const ideaSchema = z.object({
  title: z.string().trim().min(1, "Enter a title for the idea").max(200),
  description: optionalText(4000),
  category: optionalText(60),
  priority: z.coerce.number().int().min(1).max(4).default(3),
  relatedModule: z.preprocess(
    blank,
    z
      .string()
      .regex(/^[a-z][a-z0-9-]*$/)
      .optional(),
  ),
  notes: optionalText(4000),
});

export const ideaStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(IDEA_STATUSES),
});

// ---------- task detail, reminders, milestones ----------
export const taskEditSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1, "Enter a task title").max(300),
  description: optionalText(4000),
  priority: z.coerce.number().int().min(1).max(4),
  dueDate: optionalDate,
  projectId: z.preprocess(blank, z.string().uuid().optional()),
  category: optionalText(60),
});

export const subtaskSchema = z.object({
  parentId: z.string().uuid(),
  title: z.string().trim().min(1, "Enter a subtask title").max(300),
});

export const reminderSchema = z.object({
  taskId: z.string().uuid(),
  message: z.string().trim().min(1, "Enter a reminder message").max(500),
  remindAt: localDateTime,
});

export const milestoneSchema = z.object({
  goalId: z.string().uuid(),
  title: z.string().trim().min(1, "Enter a milestone title").max(200),
  dueDate: optionalDate,
});

// ---------- vault ----------
export const VAULT_MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // hosting request limit; the bucket itself allows 25 MB
export const VAULT_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "text/markdown",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

const vaultTags = z.preprocess(
  (v) =>
    typeof v === "string"
      ? v
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : v,
  z.array(z.string().max(30)).max(20).default([]),
);

export const vaultNoteSchema = z.object({
  title: z.string().trim().min(1, "Enter a title").max(200),
  body: z.string().max(20000).default(""),
  category: optionalText(60),
  tags: vaultTags,
});

export const vaultLinkSchema = z.object({
  title: z.string().trim().min(1, "Enter a title").max(200),
  url: z
    .string()
    .trim()
    .url("Enter a valid link")
    .refine((u) => /^https?:\/\//i.test(u), "Links must start with http:// or https://"),
  body: z.string().max(20000).default(""),
  category: optionalText(60),
  tags: vaultTags,
});

// ---------- assistant ----------
export const ASSISTANT_MAX_MESSAGE_CHARS = 4000;
export const ASSISTANT_DAILY_MESSAGE_LIMIT = 50;

export const assistantMessageSchema = z.object({
  conversationId: z.preprocess(blank, z.string().uuid().optional()),
  message: z
    .string()
    .trim()
    .min(1, "Type a message")
    .max(
      ASSISTANT_MAX_MESSAGE_CHARS,
      `Messages are limited to ${ASSISTANT_MAX_MESSAGE_CHARS} characters`,
    ),
});

// ---------- academics and flashcards ----------
export const ASSIGNMENT_STATUSES = ["todo", "in_progress", "submitted", "graded"] as const;
export const COURSE_STATUSES = ["active", "completed", "dropped"] as const;

export const courseSchema = z.object({
  name: z.string().trim().min(1, "Enter a course name").max(200),
  code: optionalText(30),
  term: optionalText(60),
  instructor: optionalText(120),
  credits: z.preprocess(
    blank,
    z.coerce.number().min(0, "Credits cannot be negative").max(99).optional(),
  ),
});

export const assignmentSchema = z.object({
  courseId: z.string().uuid("Choose a course"),
  title: z.string().trim().min(1, "Enter an assignment title").max(300),
  description: optionalText(4000),
  dueDate: optionalDate,
  maxScore: z.preprocess(
    blank,
    z.coerce.number().positive("Maximum score must be above zero").default(100),
  ),
  weightPercent: z.preprocess(blank, z.coerce.number().min(0).max(100).optional()),
});

export const assignmentUpdateSchema = z
  .object({
    id: z.string().uuid(),
    status: z.enum(ASSIGNMENT_STATUSES),
    score: z.preprocess(blank, z.coerce.number().min(0, "Score cannot be negative").optional()),
    maxScore: z.coerce.number().positive(),
  })
  .refine((a) => a.score === undefined || a.score <= a.maxScore, {
    message: "Score cannot exceed the maximum score",
    path: ["score"],
  });

export const studyNoteSchema = z.object({
  title: z.string().trim().min(1, "Enter a title").max(200),
  body: z.string().max(50000).default(""),
  courseId: z.preprocess(blank, z.string().uuid().optional()),
  tags: vaultTags,
});

export const deckSchema = z.object({
  name: z.string().trim().min(1, "Enter a deck name").max(200),
  description: optionalText(1000),
  courseId: z.preprocess(blank, z.string().uuid().optional()),
});

export const cardSchema = z.object({
  deckId: z.string().uuid("Choose a deck"),
  front: z.string().trim().min(1, "Enter the question").max(2000),
  back: z.string().trim().min(1, "Enter the answer").max(4000),
});

export const cardReviewSchema = z.object({
  id: z.string().uuid(),
  rating: z.coerce.number().int().min(0).max(3),
});

// ---------- career ----------
export const CV_KINDS = [
  "experience",
  "education",
  "skill",
  "project",
  "certification",
  "award",
  "other",
] as const;
export const APPLICATION_STATUSES = [
  "wishlist",
  "applied",
  "interviewing",
  "offer",
  "rejected",
  "withdrawn",
] as const;
export const INTERVIEW_CATEGORIES = [
  "behavioural",
  "technical",
  "situational",
  "company",
  "other",
] as const;
export const PORTFOLIO_KINDS = [
  "project",
  "publication",
  "certificate",
  "design",
  "other",
] as const;

const optionalUrl = z.preprocess(
  blank,
  z
    .string()
    .trim()
    .max(500)
    .url("Enter a valid link")
    .refine((u) => /^https?:\/\//i.test(u), "Links must start with http:// or https://")
    .optional(),
);

export const careerProfileSchema = z.object({
  headline: optionalText(200),
  summary: optionalText(4000),
  location: optionalText(120),
  website: optionalUrl,
  linkedinUrl: optionalUrl,
  githubUrl: optionalUrl,
});

export const cvEntrySchema = z
  .object({
    kind: z.enum(CV_KINDS),
    title: z.string().trim().min(1, "Enter a title").max(200),
    organisation: optionalText(200),
    location: optionalText(120),
    startDate: optionalDate,
    endDate: optionalDate,
    description: optionalText(4000),
  })
  .refine((e) => !e.startDate || !e.endDate || e.endDate >= e.startDate, {
    message: "The end date cannot be before the start date",
    path: ["endDate"],
  });

export const applicationSchema = z.object({
  company: z.string().trim().min(1, "Enter the company").max(200),
  role: z.string().trim().min(1, "Enter the role").max(200),
  url: optionalUrl,
  status: z.enum(APPLICATION_STATUSES).default("wishlist"),
  location: optionalText(120),
  appliedOn: optionalDate,
  deadline: optionalDate,
  contactName: optionalText(120),
  notes: optionalText(4000),
});

export const applicationStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(APPLICATION_STATUSES),
});

export const interviewPrepSchema = z.object({
  question: z.string().trim().min(1, "Enter the question").max(1000),
  answer: optionalText(4000),
  category: z.enum(INTERVIEW_CATEGORIES).default("behavioural"),
  confidence: z.coerce.number().int().min(1).max(5).default(3),
  applicationId: z.preprocess(blank, z.string().uuid().optional()),
});

export const portfolioSchema = z.object({
  title: z.string().trim().min(1, "Enter a title").max(200),
  kind: z.enum(PORTFOLIO_KINDS).default("project"),
  url: optionalUrl,
  description: optionalText(2000),
  tags: vaultTags,
});

// ---------- research ----------
export const RESEARCH_KINDS = ["paper", "book", "article", "website", "report", "other"] as const;
export const RESEARCH_STATUSES = ["to_read", "reading", "read"] as const;

export const researchSourceSchema = z.object({
  title: z.string().trim().min(1, "Enter a title").max(300),
  authors: optionalText(300),
  publishedYear: z.preprocess(
    blank,
    z.coerce
      .number()
      .int()
      .min(1000, "Enter a valid year")
      .max(2200, "Enter a valid year")
      .optional(),
  ),
  kind: z.enum(RESEARCH_KINDS).default("article"),
  url: optionalUrl,
  summary: optionalText(20000),
  courseId: z.preprocess(blank, z.string().uuid().optional()),
  tags: vaultTags,
});

export const researchStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(RESEARCH_STATUSES),
});

// ---------- chess ----------
export const CHESS_MAX_PGN_CHARS = 1_000_000; // pasted or uploaded text per import
export const CHESS_MAX_GAMES_PER_IMPORT = 200;

export const chessImportSchema = z.object({
  pgn: z
    .string()
    .min(1, "Paste a PGN or choose a .pgn file")
    .max(CHESS_MAX_PGN_CHARS, "PGN is too large"),
});

const chessUsername = z.preprocess(
  blank,
  z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{2,30}$/, "Usernames use letters, numbers, _ and -")
    .optional(),
);

export const chessProfileSchema = z.object({
  playerNames: z.preprocess(
    (v) =>
      typeof v === "string"
        ? v
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : v,
    z.array(z.string().max(100)).max(10, "Use at most 10 names").default([]),
  ),
  lichessUsername: chessUsername,
  chesscomUsername: chessUsername,
});

export const chessNotesSchema = z.object({
  id: z.string().uuid(),
  notes: z.string().max(4000).default(""),
  tags: vaultTags,
});

export const CHESS_PUZZLE_MIN_LOSS = 80; // centipawns; "mistake" or worse
export const chessPuzzleSaveSchema = z.object({
  gameId: z.string().uuid(),
  items: z
    .array(
      z.object({
        ply: z.number().int().min(1).max(1000),
        best: z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/),
        loss: z.number().int().min(0).max(3000),
        depth: z.number().int().min(0).max(60),
      }),
    )
    .min(1, "No mistakes to save")
    .max(100),
});

export const chessPuzzleAttemptSchema = z.object({
  id: z.string().uuid(),
  revision: z.coerce.number().int().min(1),
  move: z.string().regex(/^([a-h][1-8][a-h][1-8][qrbn]?|reveal)$/),
});

// ---------- running ----------
export const RUN_KINDS = [
  "easy",
  "long",
  "tempo",
  "intervals",
  "race",
  "trail",
  "treadmill",
  "other",
] as const;
export const RUN_MAX_GPX_BYTES = 4_000_000; // stays under the 4.5 MB request limit of the host

const optionalInt = (min: number, max: number) =>
  z.preprocess(blank, z.coerce.number().int().min(min).max(max).optional());
const durationPart = (max: number) =>
  z.preprocess(blank, z.coerce.number().int().min(0).max(max).default(0));

export const runManualSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a name").max(200),
    kind: z.enum(RUN_KINDS).default("easy"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
    distanceKm: z.coerce.number().min(0.01, "Enter a distance").max(1000, "Distance is too large"),
    hours: durationPart(99),
    minutes: durationPart(59),
    seconds: durationPart(59),
    elevationGain: optionalInt(0, 20000),
    avgHr: optionalInt(30, 250),
    effort: optionalInt(1, 10),
    notes: optionalText(4000),
  })
  .refine((v) => v.hours * 3600 + v.minutes * 60 + v.seconds > 0, {
    message: "Enter the time it took",
    path: ["minutes"],
  });

export const runGpxSchema = z.object({
  name: optionalText(200),
  kind: z.enum(RUN_KINDS).default("easy"),
});

export const runEditSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Enter a name").max(200),
  kind: z.enum(RUN_KINDS),
  effort: optionalInt(1, 10),
  notes: z.string().max(4000).default(""),
});

export const RUN_GOALS = ["5k", "10k", "half", "marathon"] as const;

export const runPlanSchema = z.object({
  goal: z.enum(RUN_GOALS),
  raceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the race date"),
  daysPerWeek: z.coerce.number().int().min(3, "Choose 3 to 6 days").max(6, "Choose 3 to 6 days"),
  currentWeeklyKm: z.coerce.number().min(0).max(250, "Enter your weekly distance in km"),
  name: optionalText(200),
});

export const runSessionStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["planned", "done", "skipped"]),
});

// ---------- business ----------
export const VENTURE_STAGES = [
  "idea",
  "validating",
  "building",
  "launched",
  "paused",
  "closed",
] as const;
export const ENTRY_KINDS = ["income", "expense"] as const;

export const ventureSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(120),
  stage: z.enum(VENTURE_STAGES).default("idea"),
  currency: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toUpperCase() : v),
    z
      .string()
      .regex(/^[A-Z]{3}$/, "Use a 3-letter currency code such as UGX")
      .default("UGX"),
  ),
  description: optionalText(4000),
  website: optionalUrl,
  startedOn: optionalDate,
});

export const ventureStageSchema = z.object({
  id: z.string().uuid(),
  stage: z.enum(VENTURE_STAGES),
});

export const ventureEntrySchema = z.object({
  ventureId: z.string().uuid(),
  kind: z.enum(ENTRY_KINDS),
  amount: z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/,/g, "").trim() : v),
    z.coerce
      .number({ invalid_type_error: "Enter an amount" })
      .positive("Amount must be more than zero")
      .max(999_999_999_999, "Amount is too large")
      .refine((n) => Math.round(n * 100) / 100 === n, "Use at most two decimal places"),
  ),
  occurredOn: optionalDate,
  category: optionalText(60),
  description: optionalText(500),
});

export const CONTACT_ROLES = [
  "customer",
  "supplier",
  "partner",
  "investor",
  "mentor",
  "other",
] as const;
export const VENTURE_TASK_STATUSES = ["todo", "doing", "done"] as const;

export const ventureContactSchema = z.object({
  ventureId: z.string().uuid(),
  name: z.string().trim().min(1, "Enter a name").max(120),
  role: z.enum(CONTACT_ROLES).default("other"),
  email: z.preprocess(blank, z.string().trim().max(200).email("Enter a valid email").optional()),
  phone: optionalText(40),
  notes: optionalText(2000),
});

export const ventureTaskSchema = z.object({
  ventureId: z.string().uuid(),
  title: z.string().trim().min(1, "Enter a title").max(200),
  dueOn: optionalDate,
  notes: optionalText(2000),
});

export const ventureTaskStatusSchema = z.object({
  id: z.string().uuid(),
  ventureId: z.string().uuid(),
  status: z.enum(VENTURE_TASK_STATUSES),
});

// ---------- personal ----------
export const DATE_KINDS = ["birthday", "anniversary", "deadline", "other"] as const;

export const journalSchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  mood: z.preprocess(blank, z.coerce.number().int().min(1).max(5).optional()),
  body: z
    .string()
    .trim()
    .min(1, "Write something first")
    .max(20000, "Use at most 20,000 characters"),
  tags: z.preprocess(
    (v) =>
      typeof v === "string"
        ? v
            .split(",")
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean)
        : v,
    z.array(z.string().max(40)).max(20).default([]),
  ),
});

export const importantDateSchema = z
  .object({
    title: z.string().trim().min(1, "Enter a title").max(160),
    kind: z.enum(DATE_KINDS).default("other"),
    month: z.coerce.number().int().min(1).max(12),
    day: z.coerce.number().int().min(1).max(31),
    year: z.preprocess(blank, z.coerce.number().int().min(1900).max(2200).optional()),
    notes: optionalText(1000),
  })
  .refine(
    (v) => {
      const d = new Date(Date.UTC(v.year ?? 2000, v.month - 1, v.day));
      return d.getUTCMonth() === v.month - 1 && d.getUTCDate() === v.day;
    },
    { message: "That date does not exist", path: ["day"] },
  );
