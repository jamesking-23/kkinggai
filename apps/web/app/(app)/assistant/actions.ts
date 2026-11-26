"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";

function back(conversationId: string | null, kind: "error" | "message", text: string): never {
  const c = conversationId ? `c=${conversationId}&` : "";
  redirect(`/assistant?${c}${kind}=${encodeURIComponent(text)}`);
}

export async function deleteConversation(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_conversations")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) back(id, "error", "Could not delete the conversation.");
  revalidatePath("/assistant");
  redirect("/assistant?message=" + encodeURIComponent("Conversation deleted"));
}
