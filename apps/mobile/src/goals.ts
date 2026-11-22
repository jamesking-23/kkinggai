// Goal helpers, mirroring the website's rules (apps/web/lib/productivity.ts). Pure.

export type GoalRow = {
  id: string;
  title: string;
  target_value: number | null;
  current_value: number;
  unit: string | null;
  deadline: string | null;
  status: "active" | "achieved" | "abandoned";
  revision: number;
};

export type MilestoneRow = {
  id: string;
  goal_id: string;
  title: string;
  due_date: string | null;
  completed_at: string | null;
};

/** Percent complete (0-100), or null when the goal has no numeric target. */
export function goalProgress(current: number, target: number | null): number | null {
  if (target === null || !(target > 0) || !Number.isFinite(current)) return null;
  return Math.min(100, Math.max(0, Math.round((current / target) * 100)));
}

/** A non-negative number from text typed on the phone (accepts a decimal comma), or null when it is not one. */
export function parseValue(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) && n <= 1e12 ? n : null;
}

/** "Overdue", "Due today", "Due in 3 days" or "Due 2027-01-05" for a YYYY-MM-DD deadline against today's YYYY-MM-DD. */
export function deadlineLabel(deadline: string | null, today: string): string {
  if (!deadline) return "";
  const d = Date.parse(`${deadline.slice(0, 10)}T00:00:00Z`);
  const t = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(d) || !Number.isFinite(t)) return "";
  const days = Math.round((d - t) / 86_400_000);
  if (days < 0) return "Overdue";
  if (days === 0) return "Due today";
  if (days <= 14) return `Due in ${days} day${days === 1 ? "" : "s"}`;
  return `Due ${deadline.slice(0, 10)}`;
}

/** Active goals first (soonest deadline first, no deadline last), then achieved, then abandoned. Stable otherwise. */
export function sortGoals(goals: readonly GoalRow[]): GoalRow[] {
  const rank = { active: 0, achieved: 1, abandoned: 2 } as const;
  return [...goals].sort((a, b) => {
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    if (a.status === "active") {
      const da = a.deadline ? a.deadline.slice(0, 10) : "9999-99-99";
      const db = b.deadline ? b.deadline.slice(0, 10) : "9999-99-99";
      if (da !== db) return da < db ? -1 : 1;
    }
    return 0;
  });
}

/** "12 of 50 km" style text; just the number when there is no target. */
export function valueText(g: Pick<GoalRow, "current_value" | "target_value" | "unit">): string {
  const unit = g.unit ? ` ${g.unit}` : "";
  return g.target_value !== null
    ? `${g.current_value} of ${g.target_value}${unit}`
    : `${g.current_value}${unit}`;
}
