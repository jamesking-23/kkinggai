"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { profileSchema } from "@kkingg/schemas";
import { createClient } from "../../lib/supabase/server";
import { WORKSPACE_COOKIE } from "../../lib/workspace";

export async function switchWorkspace(formData: FormData) {
  const id = String(formData.get("workspaceId") ?? "");
  const supabase = await createClient();
  // RLS limits this to workspaces the user belongs to, so a foreign id finds nothing.
  const { data } = await supabase.from("workspaces").select("id").eq("id", id).maybeSingle();
  if (data) {
    const store = await cookies();
    store.set(WORKSPACE_COOKIE, data.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  revalidatePath("/", "layout");
  redirect("/");
}

export async function updateProfile(formData: FormData) {
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/settings?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid")}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profile, settings] = await Promise.all([
    supabase.from("profiles").update({ display_name: parsed.data.displayName }).eq("id", user.id),
    supabase
      .from("user_settings")
      .update({ timezone: parsed.data.timezone })
      .eq("user_id", user.id),
  ]);
  if (profile.error || settings.error) {
    redirect(`/settings?error=${encodeURIComponent("Could not save your changes")}`);
  }

  revalidatePath("/", "layout");
  redirect(`/settings?message=${encodeURIComponent("Saved")}`);
}
