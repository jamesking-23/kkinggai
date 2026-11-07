"use server";

import { revalidatePath } from "next/cache";
import { flash } from "../../../../lib/form";
import { getAppContext } from "../../../../lib/session";
import { createClient } from "../../../../lib/supabase/server";

const PATH = "/settings/modules";

export async function toggleModule(formData: FormData) {
  const moduleId = String(formData.get("moduleId") ?? "");
  const enable = formData.get("enable") === "1";
  const ctx = await getAppContext();
  const supabase = await createClient();

  // The database enforces dependencies, core modules and who may change them; we only relay the outcome.
  const { data, error } = await supabase
    .from("workspace_modules")
    .update({ enabled: enable })
    .eq("workspace_id", ctx.current.id)
    .eq("module_id", moduleId)
    .select("module_id");

  if (error) {
    // 23514 = our own rule messages ("requires X", "required by Y", "core module"), safe to show.
    flash(PATH, "error", error.code === "23514" ? error.message : "Could not change the module");
  }
  if (!data || data.length === 0) {
    flash(PATH, "error", "Only workspace owners and admins can change modules");
  }
  revalidatePath("/", "layout");
  flash(PATH, "message", enable ? "Module enabled" : "Module disabled");
}
