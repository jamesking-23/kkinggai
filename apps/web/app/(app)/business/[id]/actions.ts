"use server";

import { revalidatePath } from "next/cache";
import { ventureContactSchema, ventureTaskSchema, ventureTaskStatusSchema } from "@kkingg/schemas";
import { firstIssue, flash } from "../../../../lib/form";
import { createClient } from "../../../../lib/supabase/server";

const STALE = "This item was changed elsewhere. Reload and try again.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only ever redirects to a venture page: the id is checked before it is put in a path. */
function pathFor(formData: FormData): string {
  const id = String(formData.get("ventureId") ?? "");
  return UUID.test(id) ? `/business/${id}` : "/business";
}

export async function addContact(formData: FormData) {
  const path = pathFor(formData);
  const parsed = ventureContactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(path, "error", firstIssue(parsed.error));
  const c = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("venture_contacts").insert({
    venture_id: c.ventureId,
    name: c.name,
    role: c.role,
    email: c.email ?? null,
    phone: c.phone ?? null,
    notes: c.notes ?? "",
  });
  if (error) flash(path, "error", "Could not save the contact");
  revalidatePath(path);
  flash(path, "message", "Contact added");
}

export async function addTask(formData: FormData) {
  const path = pathFor(formData);
  const parsed = ventureTaskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(path, "error", firstIssue(parsed.error));
  const t = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("venture_tasks").insert({
    venture_id: t.ventureId,
    title: t.title,
    due_on: t.dueOn ?? null,
    notes: t.notes ?? "",
  });
  if (error) flash(path, "error", "Could not save the task");
  revalidatePath(path);
  flash(path, "message", "Task added");
}

export async function setTaskStatus(formData: FormData) {
  const path = pathFor(formData);
  const parsed = ventureTaskStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(path, "error", firstIssue(parsed.error));
  const revision = Number(formData.get("revision"));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("venture_tasks")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .eq("revision", revision)
    .select("id");
  if (error) flash(path, "error", "Could not update the task");
  if (!data || data.length === 0) flash(path, "error", STALE);
  revalidatePath(path);
  flash(path, "message", "Task updated");
}

async function softDelete(
  table: "venture_tasks" | "venture_contacts",
  formData: FormData,
  label: string,
) {
  const path = pathFor(formData);
  const id = String(formData.get("id") ?? "");
  const revision = Number(formData.get("revision"));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("revision", revision)
    .select("id");
  if (error) flash(path, "error", `Could not remove the ${label}`);
  if (!data || data.length === 0) flash(path, "error", STALE);
  revalidatePath(path);
  flash(path, "message", `${label[0]!.toUpperCase()}${label.slice(1)} removed`);
}

export async function deleteTask(formData: FormData) {
  await softDelete("venture_tasks", formData, "task");
}

export async function deleteContact(formData: FormData) {
  await softDelete("venture_contacts", formData, "contact");
}
