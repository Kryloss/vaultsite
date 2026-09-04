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
 * The repo, used by the Cmd+K "open this note on GitHub" action to link at a
 * note's raw vault source. **The repo has to stay PUBLIC for this to work** —
 * every reader who isn't signed in as the owner gets a GitHub 404 otherwise,
 * and nothing on the site can tell, so the dead link is invisible from here.
 * It was private for a while and this comment said "Public repo" throughout.
 * If it ever goes private again, set this to an empty string to drop the
 * action — the palette hides it when there's nothing to point at.
 */
export const repoUrl = "https://github.com/Kryloss/vaultsite";
/** Branch the site deploys from — the one a note's source should be read on. */
export const repoBranch = "main";

/**
 * THE SIDEBAR'S SECOND LEVEL — the vault's own folders under a section row.
 * Off. Flip this to `true` to turn the whole thing back on.
 *
 * Built and then parked: the code, the styles and the reasoning are all still
 * here (lib/nav-tree.ts, `.nav-tree` in app/globals.css, the tree half of
 * components/Chrome.tsx, docs/DECISIONS.md #124), and nothing about the
 * sidebar's behaviour changes while this is false — no subtree is built, so
 * none is serialized into any page, and the drawer closes on navigation the
 * way it always did.
 *
 * What it turns on, together, because the second only exists to serve the
 * first: (1) the section you are in opens onto the vault's folders, and a
 * folder onto its notes; (2) a deliberately-opened drawer is PINNED by a
 * navigation instead of closing, so you can read two notes without reopening
 * it and re-finding your place. Turning the tree on without the pin would
 * shut the drawer every time you used it.
 *
 * Nothing in the tree opens on hover, and #124 records why — read it before
 * adding that back.
 */
export const sidebarTree = false;

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
