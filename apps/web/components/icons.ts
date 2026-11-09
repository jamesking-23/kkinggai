import {
  Box,
  Briefcase,
  Calendar,
  CheckSquare,
  FolderKanban,
  GraduationCap,
  Layers,
  LayoutDashboard,
  Lightbulb,
  Lock,
  Repeat,
  Sparkles,
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
  briefcase: Briefcase,
  "graduation-cap": GraduationCap,
  layers: Layers,
  sparkles: Sparkles,
};

/** Registry icon names resolve here; unknown names fall back to a generic icon. */
export function iconFor(name: string): LucideIcon {
  return icons[name] ?? Box;
}
