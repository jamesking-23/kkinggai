"use server";

import { revalidatePath } from "next/cache";
import { importantDateSchema, journalSchema } from "@kkingg/schemas";
import { firstIssue, flash } from "../../../lib/form";
import { createClient } from "../../../lib/supabase/server";

const PATH = "/personal";
const STALE = "This item was changed elsewhere. Reload and try again.";

export async function addJournalEntry(formData: FormData) {
  const parsed = journalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const j = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("journal_entries").insert({
    entry_date: j.entryDate,
    mood: j.mood ?? null,
    body: j.body,
    tags: j.tags,
  });
  if (error?.code === "23505")
    flash(PATH, "error", "There is already an entry for that day. Remove it first to rewrite it.");
  if (error) flash(PATH, "error", "Could not save the entry");
  revalidatePath(PATH);
  flash(PATH, "message", "Entry saved");
}

export async function addImportantDate(formData: FormData) {
  const parsed = importantDateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("important_dates").insert({
    title: d.title,
    kind: d.kind,
    month: d.month,
    day: d.day,
    year: d.year ?? null,
    notes: d.notes ?? "",
  });
  if (error) flash(PATH, "error", "Could not save the date");
  revalidatePath(PATH);
  flash(PATH, "message", "Date added");
}

async function softDelete(
  table: "journal_entries" | "important_dates",
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

export async function deleteJournalEntry(formData: FormData) {
  await softDelete("journal_entries", formData, "entry");
}

export async function deleteImportantDate(formData: FormData) {
  await softDelete("important_dates", formData, "date");
}
