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

/** Row of social icon links, sourced from lib/site-config. */
export default function SocialLinks({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-4 ${className}`}>
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
            className="text-[var(--text-tertiary)] transition-colors duration-150 hover:text-[var(--text)]"
          >
            <Icon className="h-5 w-5" />
            <span className="sr-only">{s.label}</span>
          </a>
        );
      })}
    </div>
  );
}
