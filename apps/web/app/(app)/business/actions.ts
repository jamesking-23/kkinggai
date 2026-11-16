"use server";

import { revalidatePath } from "next/cache";
import { ventureEntrySchema, ventureSchema, ventureStageSchema } from "@kkingg/schemas";
import { firstIssue, flash } from "../../../lib/form";
import { createClient } from "../../../lib/supabase/server";

const PATH = "/business";
const STALE = "This item was changed elsewhere. Reload and try again.";

export async function createVenture(formData: FormData) {
  const parsed = ventureSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("ventures").insert({
    name: v.name,
    stage: v.stage,
    currency: v.currency,
    description: v.description ?? "",
    website: v.website ?? null,
    started_on: v.startedOn ?? null,
  });
  if (error) flash(PATH, "error", "Could not save the venture");
  revalidatePath(PATH);
  flash(PATH, "message", "Venture added");
}

export async function setVentureStage(formData: FormData) {
  const parsed = ventureStageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const revision = Number(formData.get("revision"));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ventures")
    .update({ stage: parsed.data.stage })
    .eq("id", parsed.data.id)
    .eq("revision", revision)
    .select("id");
  if (error) flash(PATH, "error", "Could not update the venture");
  if (!data || data.length === 0) flash(PATH, "error", STALE);
  revalidatePath(PATH);
  flash(PATH, "message", "Stage updated");
}

export async function deleteVenture(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const revision = Number(formData.get("revision"));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ventures")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("revision", revision)
    .select("id");
  if (error) flash(PATH, "error", "Could not remove the venture");
  if (!data || data.length === 0) flash(PATH, "error", STALE);
  revalidatePath(PATH);
  flash(PATH, "message", "Venture removed (its entries are kept but hidden)");
}

export async function addEntry(formData: FormData) {
  const parsed = ventureEntrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const e = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("venture_entries").insert({
    venture_id: e.ventureId,
    kind: e.kind,
    amount: e.amount,
    occurred_on: e.occurredOn,
    category: e.category ?? null,
    description: e.description ?? "",
  });
  if (error) flash(PATH, "error", "Could not save the entry");
  revalidatePath(PATH);
  flash(PATH, "message", "Entry added");
}

export async function deleteEntry(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const revision = Number(formData.get("revision"));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("venture_entries")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("revision", revision)
    .select("id");
  if (error) flash(PATH, "error", "Could not remove the entry");
  if (!data || data.length === 0) flash(PATH, "error", STALE);
  revalidatePath(PATH);
  flash(PATH, "message", "Entry removed");
}
