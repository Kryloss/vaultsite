/**
 * Site-wide settings. EDIT YOUR SOCIAL LINKS HERE — one place, nothing else
 * to touch. Icon names must exist in components/icons.tsx.
 */
export const siteName = "Kyrylo";

/** Canonical URL — update when the custom domain (kryloss.com) is attached. */
export const siteUrl = "https://vaultsite-eta.vercel.app";

export const siteDescription =
  "Kyrylo's writing, projects, notes, and the occasional strong opinion.";

export interface SocialLink {
  label: string;
  href: string;
  icon: "github" | "instagram" | "linkedin" | "x" | "mail";
}

// ⚠️ Placeholder handles — replace with your real profile URLs.
export const socials: SocialLink[] = [
  { label: "GitHub", href: "https://github.com/kryloss", icon: "github" },
  { label: "Instagram", href: "https://instagram.com/kyryloles", icon: "instagram" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/kyrylo-leshchenko-b379383b0", icon: "linkedin" },
  { label: "X", href: "https://x.com/krylossua", icon: "x" },
  { label: "Email", href: "mailto:kyryloleshchenko@gmail.com", icon: "mail" },
];
