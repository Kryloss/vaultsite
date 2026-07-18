"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import {
  PanelIcon,
  SearchIcon,
  CanadaFlag,
  UkraineFlag,
  resolveIcon,
  GitHubIcon,
  InstagramIcon,
  LinkedInIcon,
  XIcon,
  MailIcon,
} from "@/components/icons";
import CommandPalette from "@/components/CommandPalette";
import T from "@/components/T";
import { ui } from "@/lib/ui-strings";
import type { SocialLink } from "@/lib/site-config";
import type { SearchItem } from "@/lib/vault";

export interface NavItem {
  slug: string;
  title: string;
  titleUk?: string;
  icon?: string;
  entries: { slug: string; title: string; titleUk?: string }[];
}

const socialIcons = {
  github: GitHubIcon,
  instagram: InstagramIcon,
  linkedin: LinkedInIcon,
  x: XIcon,
  mail: MailIcon,
};

/**
 * Site chrome, brianlovin-style: a floating panel icon plus a clickable
 * breadcrumb that mirrors the full path — "Post Sample · Posts · Kyrylo".
 * The sidebar starts hidden, slides in flat, and closes via backdrop/Escape.
 */
export default function Chrome({
  items,
  socials,
  siteName,
  searchIndex,
  children,
}: {
  items: NavItem[];
  socials: SocialLink[];
  siteName: string;
  searchIndex: SearchItem[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [lang, setLang] = useState<"en" | "uk">("en");
  const pathname = usePathname();

  // Restore + reflect language choice (the attribute is also set pre-paint by
  // the inline script in app/layout.tsx, so there's no flash on first load).
  useEffect(() => {
    const saved = (localStorage.getItem("lang") as "en" | "uk") || "en";
    setLang(saved);
    document.documentElement.dataset.lang = saved;
  }, []);

  const toggleLang = () => {
    const next = lang === "en" ? "uk" : "en";
    setLang(next);
    document.documentElement.dataset.lang = next;
    localStorage.setItem("lang", next);
  };

  // Close the drawer on navigation; Escape closes it; Cmd/Ctrl+K opens search.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const nav = items.map((item) => ({
    ...item,
    href: item.slug === "home" ? "/" : `/${item.slug}`,
  }));

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  // Breadcrumb: deepest location first — "Entry · Section · SiteName".
  const [sectionSlug, entrySlug] = pathname.split("/").filter(Boolean);
  const section = sectionSlug ? nav.find((i) => i.slug === sectionSlug) : undefined;
  const entry = entrySlug && section
    ? section.entries.find((e) => e.slug === entrySlug)
    : undefined;

  const crumbs: { en: string; uk?: string; href: string }[] = [];
  if (entry && section)
    crumbs.push({ en: entry.title, uk: entry.titleUk, href: pathname });
  if (section && section.slug !== "home")
    crumbs.push({ en: section.title, uk: section.titleUk, href: `/${section.slug}` });
  crumbs.push({ en: siteName, href: "/" });

  return (
    <>
      {/* Floating top-left: panel icon + clickable location path */}
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
        <span className="max-w-[70vw] truncate pr-2 text-sm font-medium">
          {crumbs.map((crumb, i) => (
            <Fragment key={crumb.href}>
              {i > 0 && <span className="text-[var(--text-tertiary)]"> · </span>}
              <Link
                href={crumb.href}
                className={`transition-colors hover:text-[var(--text)] ${
                  i === 0 ? "text-[var(--text)]" : "text-[var(--text-secondary)]"
                }`}
              >
                <T en={crumb.en} uk={crumb.uk} />
              </Link>
            </Fragment>
          ))}
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
        className={`fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r border-[var(--border)] bg-[var(--bg)] py-5 transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-6 pb-5">
          <Link href="/" className="text-base font-semibold text-[var(--text)]">
            {siteName}
          </Link>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleLang}
              aria-label={
                lang === "en" ? "Switch to Ukrainian" : "Перемкнути на англійську"
              }
              title={lang === "en" ? "English — switch to Ukrainian" : "Українська — перемкнути на англійську"}
              className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[var(--bg-hover)]"
            >
              {/* Shows the CURRENT language's flag */}
              {lang === "en" ? (
                <CanadaFlag className="h-[13px] w-[13px] rounded-full ring-1 ring-[var(--border)]" />
              ) : (
                <UkraineFlag className="h-[13px] w-[13px] rounded-full ring-1 ring-[var(--border)]" />
              )}
            </button>
            <button
              type="button"
              aria-label="Search (⌘K)"
              title="Search (⌘K)"
              onClick={() => {
                setOpen(false);
                setSearchOpen(true);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
            >
              <SearchIcon className="h-[17px] w-[17px]" />
            </button>
          </div>
        </div>

        <nav className="flex flex-col gap-1.5 overflow-y-auto px-3">
          {nav.map((item) => {
            const Icon = resolveIcon(item.icon);
            return (
              <Link
                key={item.slug}
                href={item.href}
                className={`flex items-center gap-3.5 rounded-lg px-3 py-2 text-base transition-colors duration-150 ${
                  isActive(item.href)
                    ? "bg-[var(--bg-hover)] font-medium text-[var(--text)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
                }`}
              >
                {Icon ? (
                  <Icon className="h-5 w-5 shrink-0 opacity-75" />
                ) : item.icon ? (
                  <span className="w-5 text-center text-base leading-none">{item.icon}</span>
                ) : null}
                <span><T en={item.title} uk={item.titleUk} /></span>
              </Link>
            );
          })}
        </nav>

        {/* Social links — plain icons, no background */}
        <div className="mt-auto px-6 pt-6">
          <div className="flex items-center gap-4">
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
                  <Icon className="h-[21px] w-[21px]" />
                </a>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-[var(--text-tertiary)]">
            <T {...ui.publishedFrom} />
          </p>
        </div>
      </aside>

      <CommandPalette
        items={searchIndex}
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
      />

      {/* Content — re-animates on each navigation via the pathname key */}
      <main key={pathname} className="page-in min-w-0">
        {children}
      </main>
    </>
  );
}
