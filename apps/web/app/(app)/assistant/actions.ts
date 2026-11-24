"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { providerFromEnv } from "@kkingg/ai";
import { getAppContext } from "../../../lib/session";
import { runAssistantTurn } from "../../../lib/assistant";
import { createClient } from "../../../lib/supabase/server";

function back(conversationId: string | null, kind: "error" | "message", text: string): never {
  const c = conversationId ? `c=${conversationId}&` : "";
  redirect(`/assistant?${c}${kind}=${encodeURIComponent(text)}`);
}

export async function sendMessage(formData: FormData) {
  const rawId = String(formData.get("conversationId") ?? "") || null;
  const provider = providerFromEnv(process.env);
  if (!provider)
    back(
      rawId,
      "error",
      "The assistant is not configured: no AI provider key is set on the server.",
    );

  const ctx = await getAppContext();
  const supabase = await createClient();
  const result = await runAssistantTurn(supabase, provider, ctx.current.id, {
    message: formData.get("message"),
    conversationId: formData.get("conversationId"),
  });
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
