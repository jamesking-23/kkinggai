"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@kkingg/schemas";
import { createClient } from "../../lib/supabase/server";

function back(path: string, key: "error" | "message", text: string): never {
  redirect(`${path}?${key}=${encodeURIComponent(text)}`);
}

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Invalid input";
}

export async function login(formData: FormData) {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back("/login", "error", firstIssue(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) back("/login", "error", "Incorrect email or password");
  redirect("/");
}

export async function register(formData: FormData) {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back("/register", "error", firstIssue(parsed.error));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${await origin()}/auth/callback`,
    },
  });
  if (error) back("/register", "error", error.message);
  if (data.session) redirect("/");
  back("/login", "message", "Check your email to confirm your account, then sign in.");
}

export async function forgotPassword(formData: FormData) {
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back("/forgot-password", "error", firstIssue(parsed.error));

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await origin()}/auth/callback?next=/reset-password`,
  });
  // Same response whether or not the account exists, to avoid account enumeration.
  back("/login", "message", "If that email has an account, a reset link is on its way.");
}

export async function resetPassword(formData: FormData) {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back("/reset-password", "error", firstIssue(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) back("/reset-password", "error", error.message);
  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
