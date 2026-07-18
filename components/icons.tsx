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

export function CanadaFlag({ className }: IconProps) {
  return (
    <svg viewBox="0 0 30 20" className={className} aria-hidden>
      <rect width="30" height="20" rx="2.5" fill="#fff" />
      <path d="M0 2.5A2.5 2.5 0 0 1 2.5 0H8v20H2.5A2.5 2.5 0 0 1 0 17.5zM22 0h5.5A2.5 2.5 0 0 1 30 2.5v15a2.5 2.5 0 0 1-2.5 2.5H22z" fill="#d52b1e" />
      <path fill="#d52b1e" d="M15 4l1.1 2.6 2.7-.6-.9 2.2 1.7 1.2-2.4 1 .2 2.3-2-1.3-2 1.3.2-2.3-2.4-1 1.7-1.2-.9-2.2 2.7.6z" />
    </svg>
  );
}

export function UkraineFlag({ className }: IconProps) {
  return (
    <svg viewBox="0 0 30 20" className={className} aria-hidden>
      <rect width="30" height="20" rx="2.5" fill="#ffd500" />
      <path d="M0 2.5A2.5 2.5 0 0 1 2.5 0h25A2.5 2.5 0 0 1 30 2.5V10H0z" fill="#005bbb" />
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

export function InstagramIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function LinkedInIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
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
  now: ClockIcon,
  clock: ClockIcon,
  search: SearchIcon,
  github: GitHubIcon,
  instagram: InstagramIcon,
  linkedin: LinkedInIcon,
  mail: MailIcon,
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
  "⏳": "clock",
  "⌛": "clock",
  "🕐": "clock",
};

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
