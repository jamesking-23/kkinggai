import {
  Box,
  Bell,
  Briefcase,
  Film,
  Heart,
  Newspaper,
  Calendar,
  CheckSquare,
  Crown,
  Footprints,
  FolderKanban,
  GraduationCap,
  Layers,
  LayoutDashboard,
  Lightbulb,
  Lock,
  Repeat,
  Sparkles,
  Target,
  Trophy,
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
  bell: Bell,
  briefcase: Briefcase,
  film: Film,
  heart: Heart,
  newspaper: Newspaper,
  crown: Crown,
  trophy: Trophy,
  footprints: Footprints,
  "graduation-cap": GraduationCap,
  layers: Layers,
  sparkles: Sparkles,
};

/** Registry icon names resolve here; unknown names fall back to a generic icon. */
export function iconFor(name: string): LucideIcon {
  return icons[name] ?? Box;
}
