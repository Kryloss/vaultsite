/**
 * Site-wide settings. EDIT YOUR SOCIAL LINKS HERE — one place, nothing else
 * to touch. Icon names must exist in components/icons.tsx.
 */
export const siteName = "Kyrylo";

export interface SocialLink {
  label: string;
  href: string;
  icon: "github" | "instagram" | "linkedin" | "x" | "mail";
}

// ⚠️ Placeholder handles — replace with your real profile URLs.
export const socials: SocialLink[] = [
  { label: "GitHub", href: "https://github.com/kryloss", icon: "github" },
  { label: "Instagram", href: "https://instagram.com/kryloss", icon: "instagram" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/kryloss", icon: "linkedin" },
  { label: "X", href: "https://x.com/kryloss", icon: "x" },
  { label: "Email", href: "mailto:mr.repar07@gmail.com", icon: "mail" },
];
