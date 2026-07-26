/**
 * Note maturity — the digital-garden convention, so a half-formed thought can
 * be published without reading as unfinished work.
 *
 * `maturity: seedling | budding | evergreen` in an entry's frontmatter.
 * Unset falls back to seedling, which means every note carries a badge until
 * the real values are filled in.
 */
import { ui, type Str } from "./ui-strings";

export type Maturity = "seedling" | "budding" | "evergreen";

const LABELS: Record<Maturity, Str> = {
  seedling: ui.maturitySeedling,
  budding: ui.maturityBudding,
  evergreen: ui.maturityEvergreen,
};

/** Growth stages read faster as a glyph than as a colour. */
const ICONS: Record<Maturity, string> = {
  seedling: "🌱",
  budding: "🌿",
  evergreen: "🌳",
};

export interface MaturityBadge {
  key: Maturity;
  label: Str;
  icon: string;
  /** True while the value is the fallback rather than something you set. */
  placeholder: boolean;
}

export function maturityOf(meta: Record<string, unknown>): MaturityBadge {
  const raw =
    typeof meta.maturity === "string" ? meta.maturity.trim().toLowerCase() : "";
  const known = raw in LABELS;
  const key = (known ? raw : "seedling") as Maturity;
  return {
    key,
    label: LABELS[key],
    icon: ICONS[key],
    placeholder: !known,
  };
}
