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
            rel="noreferrer"
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
