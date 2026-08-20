/**
 * Site-wide settings. EDIT YOUR SOCIAL LINKS HERE — one place, nothing else
 * to touch. Icon names must exist in components/icons.tsx.
 */
export const siteName = "Kyrylo";
/**
 * Ukrainian form of `siteName`, for the one place it's shown bilingually: the
 * breadcrumb ("Кирило · Музика"). Everywhere else `siteName` feeds machine
 * fields — RSS, OG images, JSON-LD, the sidebar wordmark — which stay in
 * Latin regardless of the reader's language, so it isn't touched there.
 */
export const siteNameUk = "Кирило";

/**
 * Full name, for the machines: the schema.org Person and the `article:author`
 * of every note. `siteName` is the short form the interface uses.
 */
export const authorName = "Kyrylo Leshchenko";

/** Canonical URL (custom domain, connected on Vercel). */
export const siteUrl = "https://kryloss.com";

/**
 * Public repo, used by the Cmd+K "open this note on GitHub" action to link at
 * a note's raw vault source. Set to an empty string to drop the action — the
 * palette hides it when there's nothing to point at.
 */
export const repoUrl = "https://github.com/Kryloss/vaultsite";
/** Branch the site deploys from — the one a note's source should be read on. */
export const repoBranch = "main";

export const siteDescription =
  "Kyrylo's writing, projects, notes, and the occasional strong opinion.";

export interface SocialLink {
  label: string;
  href: string;
  icon: "github" | "instagram" | "linkedin" | "x" | "mail";
}

/**
 * The owner's own accounts — and ONLY those.
 *
 * This list is rendered with `rel="me"` (components/SocialLinks.tsx) and
 * emitted as `sameAs` in the site's JSON-LD (lib/jsonld.ts), both of which
 * claim the account is the same person as this site. A link to somebody
 * else's profile belongs in a note, not here.
 */
export const socials: SocialLink[] = [
  { label: "GitHub", href: "https://github.com/kryloss", icon: "github" },
  { label: "Instagram", href: "https://instagram.com/kyryloles", icon: "instagram" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/kyrylo-leshchenko-b379383b0", icon: "linkedin" },
  { label: "X", href: "https://x.com/krylossua", icon: "x" },
  { label: "Email", href: "mailto:kyryloleshchenko@gmail.com", icon: "mail" },
];
