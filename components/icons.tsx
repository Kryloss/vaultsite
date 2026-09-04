/**
 * Inline SVG icon set (original, lucide-style strokes) + brand marks.
 * Sidebar icons resolve from vault frontmatter via `resolveIcon`:
 * known emoji (🏠 ✍️ 🎧 👥 🛠️ …) or names ("home", "music") map to SVGs;
 * anything unknown falls back to rendering the emoji text itself.
 */
import type { JSX } from "react";

type IconProps = { className?: string };

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function HomeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h5v-6h4v6h5V9.5" />
    </svg>
  );
}

export function PenIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function HeadphonesIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
      <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
      <path d="M4 15a2 2 0 0 1 2-2h1a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2Zm16 0a2 2 0 0 0-2-2h-1a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h1a2 2 0 0 0 2-2Z" />
    </svg>
  );
}

export function UsersIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M2.75 19.5a6.25 6.25 0 0 1 12.5 0" />
      <path d="M15.5 5.2a3.25 3.25 0 0 1 0 5.6M17.6 14a6.27 6.27 0 0 1 3.65 5.5" />
    </svg>
  );
}

export function HammerIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
      <path d="m14 12-8.5 8.5a2.12 2.12 0 0 1-3-3L11 9" />
      <path d="M16 16 21.5 10.5a1.4 1.4 0 0 0 0-2L14.9 2a1.4 1.4 0 0 0-2 0L7.5 7.5" />
    </svg>
  );
}

export function BookIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5Z" />
      <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
    </svg>
  );
}

/** An open book — "you were reading this". Used by ReadingPosition. */
export function BookOpenIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
      <path d="M12 7.5A4.5 4.5 0 0 0 7.5 3H2.5v14H8a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5.5V3H16.5A4.5 4.5 0 0 0 12 7.5Z" />
      <path d="M12 7.5V21" />
    </svg>
  );
}

export function ArrowIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function ExternalLinkIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" />
    </svg>
  );
}

export function UndoIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
      <path d="m9 7-5 5 5 5" />
      <path d="M5 12h8a6 6 0 0 1 6 6v1" />
    </svg>
  );
}

export function RedoIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
      <path d="m15 7 5 5-5 5" />
      <path d="M19 12h-8a6 6 0 0 0-6 6v1" />
    </svg>
  );
}

export function SaveIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
      <path d="M5 3h12l3 3v15H4V4a1 1 0 0 1 1-1Z" />
      <path d="M8 3v6h8V3M8 21v-7h8v7" />
    </svg>
  );
}

/** Obsidian's faceted crystal, kept as a quiet one-colour outline. */
export function ObsidianIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
      <path d="m9 2 7 2 4 6-2 9-6 3-7-4-1-8Z" />
      <path d="m9 2 3 7 8 1M12 9l-7 9M12 9v13" />
    </svg>
  );
}

export function ReloadIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
      <path d="M20 7v5h-5" />
      <path d="M19 12a7.5 7.5 0 1 0-2 5" />
    </svg>
  );
}

export function CoffeeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
      <path d="M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z" />
      <path d="M17 9h1.5a2.5 2.5 0 0 1 0 5H17" />
      <path d="M7 3.5c-.5.7-.5 1.3 0 2M11 3.5c-.5.7-.5 1.3 0 2" />
    </svg>
  );
}

export function SchoolIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
      <path d="M12 4 2 9l10 5 10-5Z" />
      <path d="M6 11.5V16c0 1.1 2.7 2.5 6 2.5s6-1.4 6-2.5v-4.5" />
      <path d="M22 9v5" />
    </svg>
  );
}

export function MenuIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function SearchIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20.5 20.5-4.6-4.6" />
    </svg>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

/**
 * The sidebar tree's disclosure twisty. Points right when shut and is turned
 * a quarter by CSS when open, so the two states are one glyph and one
 * transition rather than two icons that could drift apart.
 */
export function ChevronIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

/** Sidebar-panel icon (brianlovin-style menu affordance). */
export function PanelIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M9.5 4v16" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
      <path d="m5 5 14 14M19 5 5 19" />
    </svg>
  );
}

/* ---------- flags (for the language toggle) ---------- */

/** Circular Canada roundel — white disc, red side bands, red maple leaf. */
export function CanadaFlag({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <mask id="ca-round">
        <circle cx="12" cy="12" r="12" fill="#fff" />
      </mask>
      <g mask="url(#ca-round)">
        <rect width="24" height="24" fill="#fff" />
        <rect width="5.5" height="24" fill="#d52b1e" />
        <rect x="18.5" width="5.5" height="24" fill="#d52b1e" />
        {/* Symmetric maple leaf with stem */}
        <path
          fill="#d52b1e"
          d="M12 4l.9 3.3 2.9-1.9-1 3.4 3.3-.6-1.4 2.5 3.9 1-1.5 1.2.6 1.9-3.7-.3.5 3-2.6-2-.3 5.2h-1.6l-.3-5.2-2.6 2 .5-3-3.7.3.6-1.9L4 15.1l3.9-1-1.4-2.5 3.3.6-1-3.4 2.9 1.9z"
        />
      </g>
    </svg>
  );
}

/** Circular Ukraine roundel — blue top half, yellow bottom half. */
export function UkraineFlag({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M0 12a12 12 0 0 1 24 0z" fill="#005bbb" />
      <path d="M0 12a12 12 0 0 0 24 0z" fill="#ffd500" />
    </svg>
  );
}

/* ---------- brand marks (filled) ---------- */

export function GitHubIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.16 1.18a11 11 0 0 1 5.76 0c2.19-1.49 3.15-1.18 3.15-1.18.63 1.59.23 2.76.12 3.05.74.81 1.18 1.83 1.18 3.09 0 4.42-2.7 5.39-5.27 5.67.41.36.78 1.06.78 2.14 0 1.55-.01 2.79-.01 3.17 0 .31.21.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

/**
 * Instagram's real mark is a gradient, and a single hover colour can only
 * approximate it. The glyph is drawn TWICE — once in `currentColor` and once
 * stroked with the brand gradient — and `.social-link` cross-fades between
 * them (globals.css). Two copies rather than swapping the `stroke` on one:
 * `url(#…)` is not an interpolatable value, so a swap would snap while every
 * other icon on the row fades.
 *
 * The gradient id is shared by every instance on the page. That's fine and
 * deliberate: it's the same gradient, and SVG resolves `url(#id)` to the first
 * definition it finds.
 */
export function InstagramIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
      <defs>
        {/* Bottom-left to top-right, the way the real logo runs.
            `userSpaceOnUse` is load-bearing: without it the coordinates are
            read as FRACTIONS of the bounding box, so 2 and 22 mean 200% and
            2200%, the visible glyph lands inside a sliver of the ramp, and
            the whole thing renders as one flat pink. */}
        <linearGradient
          id="ig-grad"
          gradientUnits="userSpaceOnUse"
          x1="3"
          y1="21"
          x2="21"
          y2="3"
        >
          <stop offset="0%" stopColor="#FEDA75" />
          <stop offset="25%" stopColor="#FA7E1E" />
          <stop offset="50%" stopColor="#D62976" />
          <stop offset="75%" stopColor="#962FBF" />
          <stop offset="100%" stopColor="#4F5BD5" />
        </linearGradient>
      </defs>
      <g className="ig-plain">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
      </g>
      <g className="ig-brand" stroke="url(#ig-grad)">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.2" cy="6.8" r="0.6" fill="#D62976" stroke="none" />
      </g>
    </svg>
  );
}

/**
 * The LinkedIn mark is a single path: an outer rounded square with the "in"
 * cut out of it, so the letters show whatever is behind the icon. In one
 * colour that reads correctly — but the real logo is white letters on blue,
 * and "whatever is behind" is the page.
 *
 * `.li-plate` is a white rectangle sitting under the path, transparent until
 * the icon is hovered. Then the path takes the brand blue and the plate fills
 * the cut-out letters, which is the actual mark rather than a tinted version
 * of it. Inset half a unit so it can never peek past the rounded corners.
 */
export function LinkedInIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <rect className="li-plate" x="0.5" y="0.5" width="23" height="23" rx="2" fill="none" />
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05a3.74 3.74 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.46ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.55V9h3.57ZM22.22 0H1.77C.79 0 0 .77 0 1.72v20.55C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.72C24 .77 23.2 0 22.22 0Z" />
    </svg>
  );
}

export function XIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.67l7.73-8.84L1.25 2.25h6.83l4.71 6.23Zm-1.16 17.52h1.83L7.08 4.13H5.12Z" />
    </svg>
  );
}

export function MailIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </svg>
  );
}

export function DownloadIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
      <path d="M12 3v12" />
      <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
      <path d="M4 17.5V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5" />
    </svg>
  );
}

export function BriefcaseIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
      <rect x="2.5" y="7" width="19" height="13" rx="2.5" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M2.5 12.5h19" />
    </svg>
  );
}

/* ---------- resolution ---------- */

const byName: Record<string, (p: IconProps) => JSX.Element> = {
  home: HomeIcon,
  posts: PenIcon,
  pen: PenIcon,
  music: HeadphonesIcon,
  headphones: HeadphonesIcon,
  people: UsersIcon,
  users: UsersIcon,
  projects: HammerIcon,
  hammer: HammerIcon,
  book: BookIcon,
  coffee: CoffeeIcon,
  school: SchoolIcon,
  graduation: SchoolIcon,
  now: ClockIcon,
  clock: ClockIcon,
  search: SearchIcon,
  github: GitHubIcon,
  instagram: InstagramIcon,
  linkedin: LinkedInIcon,
  mail: MailIcon,
  briefcase: BriefcaseIcon,
  work: BriefcaseIcon,
  download: DownloadIcon,
};

const byEmoji: Record<string, keyof typeof byName> = {
  "🏠": "home",
  "✍️": "pen",
  "✍": "pen",
  "📝": "pen",
  "🎧": "headphones",
  "🎵": "headphones",
  "👥": "users",
  "🧑": "users",
  "🛠️": "hammer",
  "🛠": "hammer",
  "🔨": "hammer",
  "📖": "book",
  "📚": "book",
  "☕": "coffee",
  "🎓": "school",
  "⏳": "clock",
  "⌛": "clock",
  "🕐": "clock",
};

/** Two overlapping sheets — "copy". Matches the code-block copy button. */
export function CopyIcon(p: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...p}
    >
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

/** Tick — the confirmation state of a copy button. */
export function CheckIcon(p: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...p}
    >
      {/* Drawn from the short arm upward, not from the long arm down: the
          path's direction is what a stroke-dasharray animation follows, and a
          tick that draws itself backwards reads as an error being undone.
          Identical shape either way. */}
      <path d="M4 12l5 5L20 6" />
    </svg>
  );
}

/**
 * Vault frontmatter `icon:` → SVG component when known, else null
 * (caller renders the raw emoji as fallback).
 */
export function resolveIcon(
  icon: string | undefined
): ((p: IconProps) => JSX.Element) | null {
  if (!icon) return null;
  const key = byEmoji[icon.trim()] ?? icon.trim().toLowerCase();
  return byName[key] ?? null;
}
