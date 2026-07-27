import Link from "next/link";
import type { ReactNode } from "react";
import type { ListProps } from "@/lib/section-types";
import { resolveIcon, ClockIcon, ArrowIcon } from "@/components/icons";
import { getWikiIndex } from "@/lib/vault";
import type { ResumeData } from "@/lib/resume";
import { resumeHeadings } from "@/lib/resume";
import Resume from "@/components/Resume";
import Toc from "@/components/Toc";
import T from "@/components/T";

/** Below this many résumé blocks a rail/pill is noise, not navigation — same
 *  threshold the entry page uses for markdown headings (app/[section]/[slug]/page.tsx). */
const MIN_TOC_HEADINGS = 3;

interface NowItem {
  icon?: string;
  label?: string;
  label_uk?: string;
  note?: string;
  note_uk?: string;
  link?: string;
}

/**
 * "now" section type — a nownownow-style status page rendered from structured
 * frontmatter (no bullet list to style). main.md frontmatter:
 *
 *   type: now
 *   updated: July 2026        # optional, shown as a pill
 *   updated_uk: липень 2026
 *   items:
 *     - icon: book            # icon name or emoji (see components/icons.tsx)
 *       label: Studying for CompTIA Security+
 *       label_uk: Готуюся до CompTIA Security+
 *       link: Security+ journey   # optional wiki target / URL → card is a link
 *       note: optional sub-label
 *       note_uk: …
 */
export default function NowList({ section }: ListProps) {
  const items = (Array.isArray(section.meta.items)
    ? section.meta.items
    : []) as NowItem[];
  const updated = section.meta.updated as string | undefined;
  const updatedUk = (section.meta.updated_uk as string | undefined) ?? updated;
  const wiki = getWikiIndex();
  const resumeData = section.meta.resume as ResumeData | undefined;
  const headings = resumeData ? resumeHeadings(resumeData) : { en: [], uk: [] };
  const showToc = headings.en.length >= MIN_TOC_HEADINGS;

  const hrefFor = (link?: string): string | undefined => {
    if (!link) return undefined;
    if (/^(https?:|mailto:)/i.test(link)) return link;
    return wiki.get(link.trim().toLowerCase());
  };

  return (
    <div className="mt-6">
      {updated && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">
          <ClockIcon className="h-3.5 w-3.5" />
          <T en={`Updated ${updated}`} uk={`Оновлено ${updatedUk}`} />
        </span>
      )}

      <ul className="mt-5 flex flex-col gap-3">
        {items.map((item, i) => {
          const Icon = resolveIcon(item.icon);
          const href = hrefFor(item.link);
          const inner: ReactNode = (
            <>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-hover)] text-[var(--text)]">
                {Icon ? (
                  <Icon className="h-[19px] w-[19px]" />
                ) : (
                  <span className="text-base leading-none">{item.icon}</span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-[var(--text)]">
                    <T en={item.label ?? ""} uk={item.label_uk} />
                  </span>
                  {href && (
                    <ArrowIcon className="h-4 w-4 shrink-0 -translate-x-1 text-[var(--text-tertiary)] opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                  )}
                </span>
                {item.note && (
                  <span className="mt-0.5 block text-sm text-[var(--text-secondary)]">
                    <T en={item.note} uk={item.note_uk} />
                  </span>
                )}
              </span>
            </>
          );

          const cardClass =
            "group flex items-center gap-3.5 rounded-xl border border-[var(--border)] px-4 py-3.5 transition-colors";

          return (
            <li key={i}>
              {href ? (
                isInternal(href) ? (
                  <Link href={href} className={`${cardClass} hover:bg-[var(--bg-hover)]`}>
                    {inner}
                  </Link>
                ) : (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className={`${cardClass} hover:bg-[var(--bg-hover)]`}
                  >
                    {inner}
                  </a>
                )
              ) : (
                <div className={cardClass}>{inner}</div>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-8 text-sm text-[var(--text-tertiary)]">
        <T
          en={
            <>
              This is a{" "}
              <a
                href="https://nownownow.com/about"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:text-[var(--text)]"
              >
                now page
              </a>{" "}
              — what I&rsquo;m focused on at this point in life. It changes when
              my priorities do.
            </>
          }
          uk={
            <>
              Це{" "}
              <a
                href="https://nownownow.com/about"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:text-[var(--text)]"
              >
                now-сторінка
              </a>{" "}
              — те, на чому я зосереджений на цьому етапі життя. Вона змінюється
              разом із моїми пріоритетами.
            </>
          }
        />
      </p>

      {/* Optional `resume:` frontmatter block — see components/Resume.tsx */}
      <Resume section={section} />

      {/* Same rail/pill as an entry page's outline, keyed to the résumé's
          own blocks (lib/resume.ts) rather than markdown headings, since this
          page's body is intentionally empty — see NowList's doc comment. */}
      {showToc && (
        <Toc
          title={section.title}
          titleUk={section.titleUk}
          en={headings.en}
          uk={headings.uk}
        />
      )}
    </div>
  );
}

function isInternal(href: string): boolean {
  return href.startsWith("/");
}
