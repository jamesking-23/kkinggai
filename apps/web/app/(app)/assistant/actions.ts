"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppContext } from "../../../lib/session";
import { runAssistantTurn } from "../../../lib/assistant";
import { supabaseAssistantData } from "../../../lib/assistant-data";
import { cloudProvider, getOfflineAssistant } from "../../../lib/offline-assistant";
import { createClient } from "../../../lib/supabase/server";

function back(conversationId: string | null, kind: "error" | "message", text: string): never {
  const c = conversationId ? `c=${conversationId}&` : "";
  redirect(`/assistant?${c}${kind}=${encodeURIComponent(text)}`);
}

export async function sendMessage(formData: FormData) {
  const ctx = await getAppContext();
  const supabase = await createClient();
  const result = await runAssistantTurn(
    supabase,
    ctx.current.id,
    { message: formData.get("message"), conversationId: formData.get("conversationId") },
    {
      assistant: await getOfflineAssistant(),
      data: supabaseAssistantData(supabase, ctx.current.id, ctx.userId, ctx.timezone),
      timeZone: ctx.timezone,
      provider: cloudProvider(process.env),
    },
  );
  if (!result.ok) back(result.conversationId, "error", result.error);

  revalidatePath("/assistant");
  redirect(`/assistant?c=${result.conversationId}`);
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
