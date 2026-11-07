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
