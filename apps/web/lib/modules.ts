import { redirect } from "next/navigation";
import type { AppContext } from "./session";

/** Sends the user home when a module is switched off for the current workspace. */
export function requireModule(ctx: AppContext, moduleId: string): void {
  if (!ctx.enabledModules.has(moduleId)) redirect("/");
}
