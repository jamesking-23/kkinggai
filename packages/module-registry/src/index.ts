import { z } from "zod";

export const moduleStatusSchema = z.enum(["planned", "experimental", "active", "deprecated"]);
export type ModuleStatus = z.infer<typeof moduleStatusSchema>;

export const moduleDefinitionSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().min(1),
  description: z.string(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  status: moduleStatusSchema,
  dependencies: z.array(z.string()).default([]),
  permissions: z.array(z.string()).default([]),
  core: z.boolean().default(false),
  nav: z.object({ label: z.string(), href: z.string(), icon: z.string(), order: z.number() }),
});
export type ModuleDefinition = z.infer<typeof moduleDefinitionSchema>;

export class ModuleRegistry {
  private modules = new Map<string, ModuleDefinition>();

  register(input: unknown): ModuleDefinition {
    const mod = moduleDefinitionSchema.parse(input);
    if (this.modules.has(mod.id)) throw new Error(`Module already registered: ${mod.id}`);
    this.modules.set(mod.id, mod);
    return mod;
  }

  get(id: string): ModuleDefinition | undefined {
    return this.modules.get(id);
  }

  /** Returns missing or non-active dependencies that block enabling `id`. */
  unmetDependencies(id: string, enabled: ReadonlySet<string>): string[] {
    const mod = this.modules.get(id);
    if (!mod) throw new Error(`Unknown module: ${id}`);
    return mod.dependencies.filter((d) => !enabled.has(d));
  }

  /** Enabled modules that depend on `id` (these block disabling it). */
  enabledDependents(id: string, enabled: ReadonlySet<string>): string[] {
    return [...this.modules.values()]
      .filter((m) => enabled.has(m.id) && m.dependencies.includes(id))
      .map((m) => m.id);
  }

  /** Why `id` cannot be disabled right now, or null when it can. */
  disableBlocker(id: string, enabled: ReadonlySet<string>): string | null {
    const mod = this.modules.get(id);
    if (!mod) throw new Error(`Unknown module: ${id}`);
    if (mod.core) return `${mod.name} is a core module and cannot be disabled`;
    const dependents = this.enabledDependents(id, enabled);
    return dependents.length > 0 ? `Required by ${dependents.join(", ")}` : null;
  }

  canEnable(id: string, enabled: ReadonlySet<string>): boolean {
    return this.unmetDependencies(id, enabled).length === 0;
  }

  /** Navigation is derived from the registry: only enabled, non-deprecated, non-planned modules. */
  navigation(enabled: ReadonlySet<string>) {
    return [...this.modules.values()]
      .filter((m) => enabled.has(m.id) && (m.status === "active" || m.status === "experimental"))
      .map((m) => ({ id: m.id, ...m.nav }))
      .sort((a, b) => a.order - b.order);
  }
}
