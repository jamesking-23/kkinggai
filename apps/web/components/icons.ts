import {
  Box,
  Calendar,
  CheckSquare,
  FolderKanban,
  LayoutDashboard,
  Lightbulb,
  Lock,
  Repeat,
  Target,
  type LucideIcon,
} from "lucide-react";

const icons: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  "check-square": CheckSquare,
  "folder-kanban": FolderKanban,
  target: Target,
  calendar: Calendar,
  repeat: Repeat,
  lightbulb: Lightbulb,
  lock: Lock,
};

/** Registry icon names resolve here; unknown names fall back to a generic icon. */
export function iconFor(name: string): LucideIcon {
  return icons[name] ?? Box;
}
