"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  VAULT_MAX_UPLOAD_BYTES,
  VAULT_MIME_TYPES,
  vaultLinkSchema,
  vaultNoteSchema,
} from "@kkingg/schemas";
import { firstIssue, flash } from "../../../lib/form";
import { getAppContext } from "../../../lib/session";
import { createClient } from "../../../lib/supabase/server";

const PATH = "/vault";

export async function addNote(formData: FormData) {
  const parsed = vaultNoteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const supabase = await createClient();
  const { error } = await supabase.from("vault_items").insert({
    kind: "note",
    title: parsed.data.title,
    body: parsed.data.body,
    category: parsed.data.category ?? null,
    tags: parsed.data.tags,
  });
  if (error) flash(PATH, "error", "Could not save the note");
  revalidatePath(PATH);
  flash(PATH, "message", "Note saved");
}

export async function addLink(formData: FormData) {
  const parsed = vaultLinkSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const supabase = await createClient();
  const { error } = await supabase.from("vault_items").insert({
    kind: "link",
    title: parsed.data.title,
    url: parsed.data.url,
    body: parsed.data.body,
    category: parsed.data.category ?? null,
    tags: parsed.data.tags,
  });
  if (error) flash(PATH, "error", "Could not save the link");
  revalidatePath(PATH);
  flash(PATH, "message", "Link saved");
}

export async function addFile(formData: FormData) {
  const file = formData.get("file");
  const title = String(formData.get("title") ?? "").trim();
  if (!(file instanceof File) || file.size === 0) flash(PATH, "error", "Choose a file to upload");
  if (file.size > VAULT_MAX_UPLOAD_BYTES)
    flash(PATH, "error", `Files must be under ${VAULT_MAX_UPLOAD_BYTES / 1024 / 1024} MB`);
  if (!(VAULT_MIME_TYPES as readonly string[]).includes(file.type))
    flash(PATH, "error", "That file type is not allowed (PDF, images, text, Word, Excel)");

  const ctx = await getAppContext();
  const safeName = file.name.replace(/[^\w.\- ]+/g, "_").slice(-120);
  const path = `${ctx.userId}/${randomUUID()}-${safeName}`;
  const supabase = await createClient();

  const { error: uploadError } = await supabase.storage
    .from("vault")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) flash(PATH, "error", "Could not upload the file");

  const { error } = await supabase.from("vault_items").insert({
    kind: "file",
    title: (title || file.name).slice(0, 200),
    storage_path: path,
    mime_type: file.type,
    size_bytes: file.size,
  });
  if (error) {
    await supabase.storage.from("vault").remove([path]); // do not leave an orphaned file behind
    flash(PATH, "error", "Could not record the file");
  }
  revalidatePath(PATH);
  flash(PATH, "message", "File uploaded");
}

/** Soft delete. The stored file is kept so the item can be restored; permanent deletion is a later feature. */
export async function deleteItem(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const revision = Number(formData.get("revision"));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vault_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("revision", revision)
    .select("id");
  if (error) flash(PATH, "error", "Could not remove the item");
  if (!data || data.length === 0)
    flash(PATH, "error", "This item was changed elsewhere. Reload and try again.");
  revalidatePath(PATH);
  flash(PATH, "message", "Item removed");
}
