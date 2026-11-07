import { redirect } from "next/navigation";

/** Redirects back to `path` with a flash message that the page renders. */
export function flash(path: string, kind: "error" | "message", text: string): never {
  redirect(`${path}?${kind}=${encodeURIComponent(text)}`);
}

export function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Invalid input";
}

export type FlashParams = { error?: string; message?: string };
