import {
  Activity,
  Aperture,
  ArrowUpNarrowWide,
  Crown,
  Droplet,
  Eye,
  FlaskConical,
  HeartPulse,
  Hexagon,
  ScanFace,
  Scissors,
  Smile,
  Sparkles,
  Sprout,
  Sun,
  Syringe,
  UserRound,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Category tiles carry an icon *key* in the data (a plain string) so the
 * catalogue stays serialisable across the server/client boundary. This map
 * turns the key back into a component.
 */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  lift: ArrowUpNarrowWide,
  syringe: Syringe,
  droplet: Droplet,
  zap: Zap,
  scissors: Scissors,
  sprout: Sprout,
  scan: ScanFace,
  sun: Sun,
  eye: Eye,
  aperture: Aperture,
  hexagon: Hexagon,
  activity: Activity,
  "heart-pulse": HeartPulse,
  crown: Crown,
  user: UserRound,
  smile: Smile,
  flask: FlaskConical,
};

export function categoryIcon(key: string): LucideIcon {
  return CATEGORY_ICONS[key] ?? Sparkles;
}
