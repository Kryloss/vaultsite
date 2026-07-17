"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export interface NavItem {
  slug: string;
  title: string;
  icon?: string;
}

/**
 * brianlovin-inspired navigation: fixed left rail on desktop,
 * top bar + slide-over on mobile. Items come from vault folders
 * (passed in by app/layout.tsx).
 */
export default function Sidebar({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the mobile drawer on navigation
  useEffect(() => setOpen(false), [pathname]);

  const nav = items.map((item) => ({
    ...item,
    href: item.slug === "home" ? "/" : `/${item.slug}`,
  }));

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  const links = (
    <nav className="flex flex-col gap-0.5 px-3">
      {nav.map((item) => (
        <Link
          key={item.slug}
          href={item.href}
          className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
            isActive(item.href)
              ? "bg-[var(--accent)] font-medium text-white"
              : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
          }`}
        >
          {item.icon && <span className="text-base leading-none">{item.icon}</span>}
          <span>{item.title}</span>
        </Link>
      ))}
    </nav>
  );

  return (
    <>
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--border)] bg-[var(--bg)]/90 px-4 py-3 backdrop-blur lg:hidden">
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? (
              <>
                <line x1="5" y1="5" x2="19" y2="19" />
                <line x1="19" y1="5" x2="5" y2="19" />
              </>
            ) : (
              <>
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="17" x2="20" y2="17" />
              </>
            )}
          </svg>
        </button>
        <Link href="/" className="text-sm font-semibold text-[var(--text)]">
          Kyrylo
        </Link>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 w-64 overflow-y-auto border-r border-[var(--border)] bg-[var(--bg-sidebar)] py-4">
            <div className="px-5 pb-4">
              <span className="text-sm font-semibold text-[var(--text)]">Kyrylo</span>
            </div>
            {links}
          </aside>
        </div>
      )}

      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-[var(--border)] bg-[var(--bg-sidebar)] py-5 lg:flex">
        <div className="px-5 pb-5">
          <Link href="/" className="text-sm font-semibold text-[var(--text)]">
            Kyrylo
          </Link>
        </div>
        {links}
        <div className="mt-auto px-5 pt-6 text-xs text-[var(--text-tertiary)]">
          Published from Obsidian
        </div>
      </aside>
    </>
  );
}
