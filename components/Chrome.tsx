"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  PanelIcon,
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
 * Site chrome, brianlovin-style: no top bar — just a floating panel icon and
 * a clickable "<Section> · <SiteName>" breadcrumb in the top left. The sidebar
 * starts hidden and slides in flat (page background, hairline border only).
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
  const onHome = pathname === "/" || !current || current.slug === "home";

  return (
    <>
      {/* Floating top-left: panel icon + clickable location text */}
      <div className="fixed left-3 top-3 z-30 flex items-center gap-1 rounded-full bg-[var(--bg)]/75 px-1.5 py-1 backdrop-blur-md">
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
        >
          <PanelIcon className="h-[18px] w-[18px]" />
        </button>
        <span className="pr-2 text-sm font-medium">
          {onHome ? (
            <Link href="/" className="text-[var(--text)] transition-colors hover:text-[var(--accent)]">
              {siteName}
            </Link>
          ) : (
            <>
              <Link
                href={`/${current.slug}`}
                className="text-[var(--text)] transition-colors hover:text-[var(--accent)]"
              >
                {current.title}
              </Link>
              <span className="text-[var(--text-tertiary)]"> · </span>
              <Link
                href="/"
                className="text-[var(--text-secondary)] transition-colors hover:text-[var(--accent)]"
              >
                {siteName}
              </Link>
            </>
          )}
        </span>
      </div>

      {/* Backdrop */}
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-black/25 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Drawer — flat: page background, hairline border, text + icons only */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[var(--border)] bg-[var(--bg)] py-4 transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 pb-4">
          <Link href="/" className="text-[15px] font-semibold text-[var(--text)]">
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
                className={`flex items-center gap-3 rounded-md px-2.5 py-[7px] text-[15px] transition-colors duration-150 ${
                  isActive(item.href)
                    ? "bg-[var(--bg-hover)] font-medium text-[var(--text)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
                }`}
              >
                {Icon ? (
                  <Icon className="h-[18px] w-[18px] shrink-0 opacity-75" />
                ) : item.icon ? (
                  <span className="w-[18px] text-center text-[15px] leading-none">{item.icon}</span>
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
