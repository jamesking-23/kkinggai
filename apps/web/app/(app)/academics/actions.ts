"use server";

import { revalidatePath } from "next/cache";
import {
  ASSIGNMENT_STATUSES,
  COURSE_STATUSES,
  assignmentSchema,
  assignmentUpdateSchema,
  courseSchema,
  studyNoteSchema,
} from "@kkingg/schemas";
import { firstIssue, flash } from "../../../lib/form";
import { getAppContext } from "../../../lib/session";
import { createClient } from "../../../lib/supabase/server";
import { zonedTimeToUtc } from "../../../lib/time";

const PATH = "/academics";
const STALE = "This item was changed elsewhere. Reload and try again.";

export async function createCourse(formData: FormData) {
  const parsed = courseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const ctx = await getAppContext();
  const c = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("courses").insert({
    workspace_id: ctx.current.id,
    name: c.name,
    code: c.code ?? null,
    term: c.term ?? null,
    instructor: c.instructor ?? null,
    credits: c.credits ?? null,
  });
  if (error) flash(PATH, "error", "Could not create the course");
  revalidatePath(PATH);
  flash(PATH, "message", "Course added");
}

export async function setCourseStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const revision = Number(formData.get("revision"));
  if (!(COURSE_STATUSES as readonly string[]).includes(status))
    flash(PATH, "error", "Invalid status");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .update({ status })
    .eq("id", id)
    .eq("revision", revision)
    .select("id");
  if (error) flash(PATH, "error", "Could not update the course");
  if (!data || data.length === 0) flash(PATH, "error", STALE);
  revalidatePath(PATH);
  flash(PATH, "message", "Course updated");
}

export async function deleteCourse(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const revision = Number(formData.get("revision"));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("revision", revision)
    .select("id");
  if (error) flash(PATH, "error", "Could not remove the course");
  if (!data || data.length === 0) flash(PATH, "error", STALE);
  revalidatePath(PATH);
  flash(PATH, "message", "Course removed");
}

export async function createAssignment(formData: FormData) {
  const parsed = assignmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const ctx = await getAppContext();
  const a = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("assignments").insert({
    workspace_id: ctx.current.id,
    course_id: a.courseId,
    title: a.title,
    description: a.description ?? "",
    due_at: a.dueDate ? zonedTimeToUtc(`${a.dueDate}T23:59`, ctx.timezone).toISOString() : null,
    max_score: a.maxScore,
    weight_percent: a.weightPercent ?? null,
  });
  if (error) flash(PATH, "error", "Could not add the assignment");
  revalidatePath(PATH);
  flash(PATH, "message", "Assignment added");
}

export async function updateAssignment(formData: FormData) {
  const parsed = assignmentUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const revision = Number(formData.get("revision"));
  if (!(ASSIGNMENT_STATUSES as readonly string[]).includes(parsed.data.status))
    flash(PATH, "error", "Invalid status");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assignments")
    .update({ status: parsed.data.status, score: parsed.data.score ?? null })
    .eq("id", parsed.data.id)
    .eq("revision", revision)
    .select("id");
  if (error) flash(PATH, "error", "Could not update the assignment");
  if (!data || data.length === 0) flash(PATH, "error", STALE);
  revalidatePath(PATH);
  flash(PATH, "message", "Assignment updated");
}

export async function deleteAssignment(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const revision = Number(formData.get("revision"));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assignments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("revision", revision)
    .select("id");
  if (error) flash(PATH, "error", "Could not remove the assignment");
  if (!data || data.length === 0) flash(PATH, "error", STALE);
  revalidatePath(PATH);
  flash(PATH, "message", "Assignment removed");
}

export async function createStudyNote(formData: FormData) {
  const parsed = studyNoteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const ctx = await getAppContext();
  const n = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("study_notes").insert({
    workspace_id: ctx.current.id,
    title: n.title,
    body: n.body,
    course_id: n.courseId ?? null,
    tags: n.tags,
  });
  if (error) flash(PATH, "error", "Could not save the note");
  revalidatePath(PATH);
  flash(PATH, "message", "Note saved");
}

export async function deleteStudyNote(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const revision = Number(formData.get("revision"));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("study_notes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("revision", revision)
    .select("id");
  if (error) flash(PATH, "error", "Could not remove the note");
  if (!data || data.length === 0) flash(PATH, "error", STALE);
  revalidatePath(PATH);
  flash(PATH, "message", "Note removed");
}
