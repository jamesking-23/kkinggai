"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { TASK_FILE_MAX_BYTES, TASK_FILE_MIME_TYPES } from "@kkingg/schemas";
import { flash } from "../../../../lib/form";
import { getAppContext } from "../../../../lib/session";
import { createClient } from "../../../../lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Attach a file to a task. The metadata row is written first and the file second: the bucket has no
 * delete policy, so a file uploaded before a failed insert could never be cleaned up. If the upload
 * fails, the row is soft-deleted instead.
 */
export async function addAttachment(formData: FormData) {
  const taskId = String(formData.get("taskId") ?? "");
  if (!UUID.test(taskId)) flash("/tasks", "error", "That task no longer exists");
  const path = `/tasks/${taskId}`;
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) flash(path, "error", "Choose a file to attach");
  if (file.size > TASK_FILE_MAX_BYTES)
    flash(path, "error", `Files must be under ${TASK_FILE_MAX_BYTES / 1024 / 1024} MB`);
  if (!(TASK_FILE_MIME_TYPES as readonly string[]).includes(file.type))
    flash(path, "error", "That file type is not allowed (PDF, images, text, Word .docx, Excel)");

  const ctx = await getAppContext();
  const supabase = await createClient();
  const { data: task } = await supabase
    .from("tasks")
    .select("id")
    .eq("id", taskId)
    .eq("workspace_id", ctx.current.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!task) flash("/tasks", "error", "That task no longer exists");

  const safeName = file.name.replace(/[^\w.-]+/g, "_").slice(-120);
  const storagePath = `${ctx.current.id}/${taskId}/${randomUUID()}-${safeName}`;

  const { data: row, error } = await supabase
    .from("task_attachments")
    .insert({
      workspace_id: ctx.current.id,
      task_id: taskId,
      storage_path: storagePath,
      file_name: file.name.slice(0, 200),
      mime_type: file.type,
      size_bytes: file.size,
    })
    .select("id")
    .single();
  if (error || !row) flash(path, "error", "Could not attach the file");

  const { error: uploadError } = await supabase.storage
    .from("task-files")
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (uploadError) {
    await supabase
      .from("task_attachments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", row.id);
    flash(path, "error", "Could not upload the file");
  }
  revalidatePath(path);
  flash(path, "message", "File attached");
}

/** Soft delete. The stored file is kept (there is no delete policy on the bucket). */
export async function removeAttachment(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  const revision = Number(formData.get("revision"));
  const path = UUID.test(taskId) ? `/tasks/${taskId}` : "/tasks";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_attachments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("revision", revision)
    .select("id");
  if (error) flash(path, "error", "Could not remove the attachment");
  if (!data || data.length === 0)
    flash(path, "error", "This attachment was changed elsewhere. Reload and try again.");
  revalidatePath(path);
  flash(path, "message", "Attachment removed");
}
