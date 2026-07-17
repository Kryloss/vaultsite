/**
 * Site-wide settings. EDIT YOUR SOCIAL LINKS HERE — one place, nothing else
 * to touch. Icon names must exist in components/icons.tsx.
 */
export const siteName = "Kyrylo";

export interface SocialLink {
  label: string;
  href: string;
  icon: "github" | "instagram" | "linkedin" | "mail";
}

// ⚠️ Placeholder handles — replace with your real profile URLs.
export const socials: SocialLink[] = [
  { label: "GitHub", href: "https://github.com/kryloss", icon: "github" },
  { label: "Instagram", href: "https://instagram.com/kryloss", icon: "instagram" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/kryloss", icon: "linkedin" },
  { label: "Email", href: "mailto:mr.repar07@gmail.com", icon: "mail" },
];
