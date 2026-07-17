"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  MenuIcon,
  CloseIcon,
  resolveIcon,
  GitHubIcon,
  InstagramIcon,
  LinkedInIcon,
  MailIcon,
} from "@/components/icons";
import type { SocialLink } from "@/lib/site-config";

export interface NavItem {
  slug: string;
  title: string;
  icon?: string;
}

const socialIcons = {
  github: GitHubIcon,
  instagram: InstagramIcon,
  linkedin: LinkedInIcon,
  mail: MailIcon,
};

/**
 * Site chrome, brianlovin-style: sidebar starts hidden and slides in from a
 * menu button; a slim sticky header shows "<Section> · <SiteName>". Content
 * fades up on every navigation (`page-in` keyframes in globals.css).
 */
export default function Chrome({
  items,
  socials,
  siteName,
  children,
}: {
  items: NavItem[];
  socials: SocialLink[];
  siteName: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer on navigation and on Escape.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const nav = items.map((item) => ({
    ...item,
    href: item.slug === "home" ? "/" : `/${item.slug}`,
  }));

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  const sectionSlug = pathname.split("/")[1] || "home";
  const current = nav.find((i) => i.slug === sectionSlug);
  const crumb =
    pathname === "/" || !current ? siteName : `${current.title} · ${siteName}`;

  return (
    <>
      {/* Sticky header: menu button + location breadcrumb, top left */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--border)] bg-[var(--bg)]/85 px-4 py-2.5 backdrop-blur-md">
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
        >
          {open ? <CloseIcon className="h-[18px] w-[18px]" /> : <MenuIcon className="h-[18px] w-[18px]" />}
        </button>
        <span className="truncate text-sm font-medium text-[var(--text)]">
          {crumb}
        </span>
      </header>

      {/* Backdrop */}
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Drawer sidebar — hidden by default, slides in */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[var(--border)] bg-[var(--bg-sidebar)] py-4 shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 pb-4">
          <Link href="/" className="text-sm font-semibold text-[var(--text)]">
            {siteName}
          </Link>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex flex-col gap-0.5 overflow-y-auto px-3">
          {nav.map((item) => {
            const Icon = resolveIcon(item.icon);
            return (
              <Link
                key={item.slug}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors duration-150 ${
                  isActive(item.href)
                    ? "bg-[var(--accent)] font-medium text-white"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
                }`}
              >
                {Icon ? (
                  <Icon className="h-4 w-4 shrink-0 opacity-80" />
                ) : item.icon ? (
                  <span className="w-4 text-center text-sm leading-none">{item.icon}</span>
                ) : null}
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>

        {/* Social links */}
        <div className="mt-auto px-5 pt-6">
          <div className="flex items-center gap-1">
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
                  className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-tertiary)] transition-all duration-150 hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
                >
                  <Icon className="h-[17px] w-[17px]" />
                </a>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-[var(--text-tertiary)]">
            Published from Obsidian
          </p>
        </div>
      </aside>

      {/* Content — re-animates on each navigation via the pathname key */}
      <main key={pathname} className="page-in min-w-0">
        {children}
      </main>
    </>
  );
}
