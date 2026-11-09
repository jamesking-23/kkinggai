"use server";

import { revalidatePath } from "next/cache";
import {
  applicationSchema,
  applicationStatusSchema,
  interviewPrepSchema,
  portfolioSchema,
} from "@kkingg/schemas";
import { firstIssue, flash } from "../../../lib/form";
import { createClient } from "../../../lib/supabase/server";

const PATH = "/career";
const STALE = "This item was changed elsewhere. Reload and try again.";

async function softDelete(
  table: "job_applications" | "interview_prep" | "portfolio_items",
  formData: FormData,
  label: string,
) {
  const id = String(formData.get("id") ?? "");
  const revision = Number(formData.get("revision"));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("revision", revision)
    .select("id");
  if (error) flash(PATH, "error", `Could not remove the ${label}`);
  if (!data || data.length === 0) flash(PATH, "error", STALE);
  revalidatePath(PATH);
  flash(PATH, "message", `${label[0]!.toUpperCase()}${label.slice(1)} removed`);
}

export async function createApplication(formData: FormData) {
  const parsed = applicationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const a = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("job_applications").insert({
    company: a.company,
    role: a.role,
    url: a.url ?? null,
    status: a.status,
    location: a.location ?? null,
    applied_on: a.appliedOn ?? null,
    deadline: a.deadline ?? null,
    contact_name: a.contactName ?? null,
    notes: a.notes ?? "",
  });
  if (error) flash(PATH, "error", "Could not save the application");
  revalidatePath(PATH);
  flash(PATH, "message", "Application added");
}

export async function setApplicationStatus(formData: FormData) {
  const parsed = applicationStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const revision = Number(formData.get("revision"));
  const patch: { status: string; applied_on?: string } = { status: parsed.data.status };
  // Moving to "applied" with no date recorded stamps today (UTC date).
  if (parsed.data.status === "applied" && formData.get("hasAppliedOn") !== "1")
    patch.applied_on = new Date().toISOString().slice(0, 10);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_applications")
    .update(patch)
    .eq("id", parsed.data.id)
    .eq("revision", revision)
    .select("id");
  if (error) flash(PATH, "error", "Could not update the application");
  if (!data || data.length === 0) flash(PATH, "error", STALE);
  revalidatePath(PATH);
  flash(PATH, "message", "Status updated");
}

export async function deleteApplication(formData: FormData) {
  await softDelete("job_applications", formData, "application");
}

export async function addInterviewPrep(formData: FormData) {
  const parsed = interviewPrepSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const q = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("interview_prep").insert({
    question: q.question,
    answer: q.answer ?? "",
    category: q.category,
    confidence: q.confidence,
    application_id: q.applicationId ?? null,
  });
  if (error) flash(PATH, "error", "Could not save the question");
  revalidatePath(PATH);
  flash(PATH, "message", "Question added");
}

export async function deleteInterviewPrep(formData: FormData) {
  await softDelete("interview_prep", formData, "question");
}

export async function addPortfolioItem(formData: FormData) {
  const parsed = portfolioSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const p = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("portfolio_items").insert({
    title: p.title,
    kind: p.kind,
    url: p.url ?? null,
    description: p.description ?? "",
    tags: p.tags,
  });
  if (error) flash(PATH, "error", "Could not save the portfolio item");
  revalidatePath(PATH);
  flash(PATH, "message", "Portfolio item added");
}

export async function deletePortfolioItem(formData: FormData) {
  await softDelete("portfolio_items", formData, "portfolio item");
}
