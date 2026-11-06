import { Box, CheckSquare, LayoutDashboard, type LucideIcon } from "lucide-react";

const icons: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  "check-square": CheckSquare,
};

/** Registry icon names resolve here; unknown names fall back to a generic icon. */
export function iconFor(name: string): LucideIcon {
  return icons[name] ?? Box;
}
