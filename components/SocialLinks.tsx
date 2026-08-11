import {
  GitHubIcon,
  InstagramIcon,
  LinkedInIcon,
  XIcon,
  MailIcon,
} from "@/components/icons";
import { socials } from "@/lib/site-config";

const socialIcons = {
  github: GitHubIcon,
  instagram: InstagramIcon,
  linkedin: LinkedInIcon,
  x: XIcon,
  mail: MailIcon,
};

/**
 * Row of social icon links, sourced from lib/site-config.
 *
 * The sidebar kept a second copy of this markup at a smaller size, which is
 * how the two rows came to have different hover behaviour. It now renders this
 * with `iconClass` and `gap` set instead, so the icons behave the same
 * wherever they appear and there is one place to change them.
 *
 * `data-social` is what globals.css keys each platform's colour off: the icons
 * are drawn in `currentColor`, so the hover is a single custom property.
 *
 * **`rel="me"` is an identity claim, not decoration.** It says "that account
 * is the same person as this site", and when the profile links back the pair
 * proves it — which is exactly what Mastodon checks before showing a domain
 * as verified, and what `rel-me` sign-in reads. It's the IndieWeb half of a
 * statement the site already makes in machine-readable form: `sameAs` in
 * lib/jsonld.ts tells search engines the same thing, from the same list. The
 * one difference is the email — `sameAs` drops it because a mailto isn't a
 * profile, while `rel="me"` keeps it, since an address you control is
 * precisely the kind of identity it exists to claim.
 *
 * So every href in `socials` must be the OWNER's own account. A link to
 * someone else's profile added to that list would inherit this attribute and
 * quietly claim to be them.
 */
export default function SocialLinks({
  className = "",
  /** Tailwind size classes for the glyph. */
  iconClass = "h-[35px] w-[35px]",
  /** Tailwind gap class for the row. */
  gap = "gap-7",
}: {
  className?: string;
  iconClass?: string;
  gap?: string;
}) {
  return (
    <div className={`flex items-center ${gap} ${className}`}>
      {socials.map((s) => {
        const Icon = socialIcons[s.icon];
        return (
          <a
            key={s.label}
            href={s.href}
            target={s.href.startsWith("mailto:") ? undefined : "_blank"}
            rel="me noreferrer"
            aria-label={s.label}
            title={s.label}
            data-social={s.icon}
            className="social-link press"
          >
            <Icon className={`block ${iconClass}`} />
            <span className="sr-only">{s.label}</span>
          </a>
        );
      })}
    </div>
  );
}
