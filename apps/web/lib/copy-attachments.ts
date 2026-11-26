import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Copies a task's attachments to its next recurring copy. Each file is copied inside the bucket under the new task's
 * folder (a row's storage_path must contain its own task id) and then gets its own metadata row. Best effort: a file
 * that fails to copy is skipped, and the number copied is returned. Never throws.
 */
export async function copyAttachments(
  supabase: SupabaseClient,
  workspaceId: string,
  fromTaskId: string,
  toTaskId: string,
): Promise<number> {
  let copied = 0;
  try {
    const { data } = await supabase
      .from("task_attachments")
      .select("storage_path, file_name, mime_type, size_bytes")
      .eq("task_id", fromTaskId)
      .is("deleted_at", null);
    for (const a of data ?? []) {
      try {
        const safeName = String(a.file_name)
          .replace(/[^\w.-]+/g, "_")
          .slice(-120);
        const storagePath = `${workspaceId}/${toTaskId}/${randomUUID()}-${safeName}`;
        const { error: copyError } = await supabase.storage
          .from("task-files")
          .copy(a.storage_path, storagePath);
        if (copyError) continue;
        const { error } = await supabase.from("task_attachments").insert({
          workspace_id: workspaceId,
          task_id: toTaskId,
          storage_path: storagePath,
          file_name: a.file_name,
          mime_type: a.mime_type,
          size_bytes: a.size_bytes,
        });
        if (!error) copied++;
      } catch {
        // skip this file
      }
    }
  } catch {
    // best effort
  }
  return copied;
}
