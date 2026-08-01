import Link from "next/link";
import type { ReactNode } from "react";
import type { ListProps } from "@/lib/section-types";
import { CheckIcon, ClockIcon, ArrowIcon } from "@/components/icons";
import { getWikiIndex } from "@/lib/vault";
import type { ResumeData } from "@/lib/resume";
import { resumeHeadings } from "@/lib/resume";
import Resume from "@/components/Resume";
import Toc from "@/components/Toc";
import T from "@/components/T";

/** Below this many résumé blocks a rail/pill is noise, not navigation — same
 *  threshold the entry page uses for markdown headings (app/[section]/[slug]/page.tsx). */
const MIN_TOC_HEADINGS = 3;

interface GoalItem {
  label?: string;
  label_uk?: string;
  note?: string;
  note_uk?: string;
  link?: string;
  /** Flip by hand in Obsidian once a goal is done — the box fills solid,
   *  same visual language as the resume timeline's current-vs-past dot
   *  (components/Resume.tsx). Unset/false renders open. */
  done?: boolean;
}

/**
 * "now" section type — a nownownow-style page rendered from structured data
 * (no bullet list to style). main.md keeps the flat keys in frontmatter:
 *
 *   type: now
 *   updated: July 2026        # optional, shown as a pill
 *   updated_uk: липень 2026
 *   resume_file: …            # optional, the PDF the download button points at
 *
 * and writes the goals as a task list in the BODY, where Obsidian can edit
 * them — `lib/now-content.ts` parses that back into `meta.goals`:
 *
 *   ## Goals
 *
 *   - [ ] Pass the CompTIA Security+ exam → [[My Security+ journey]]
 *       - Requires at least a 3.0 GPA     ← indented bullet = sub-label
 *   - [x] Find a tech-related job         ← done, checkbox fills in
 *
 * A `## Résumé` section in the same body (see lib/resume.ts) renders the résumé
 * block below the goals. A hand-written `goals:`/`resume:` frontmatter block
 * still works — see docs/DECISIONS.md #26.
 */
export default function NowList({ section }: ListProps) {
  const goals = (Array.isArray(section.meta.goals)
    ? section.meta.goals
    : []) as GoalItem[];
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
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--text)]">
          <T en="Short-term goals" uk="Короткострокові цілі" />
        </h2>
        {updated && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">
            <ClockIcon className="h-3.5 w-3.5" />
            <T en={`Updated ${updated}`} uk={`Оновлено ${updatedUk}`} />
          </span>
        )}
      </header>

      <ul className="mt-5 flex flex-col gap-3">
        {goals.map((goal, i) => {
          const href = hrefFor(goal.link);
          const inner: ReactNode = (
            <>
              {/* Hollow = open, filled = done — the resume timeline uses the
                  same fill-vs-outline language for current vs. past. */}
              <span
                aria-hidden
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                  goal.done
                    ? "border-[var(--text)] bg-[var(--text)] text-[var(--bg)]"
                    : "border-[var(--border)] text-transparent"
                }`}
              >
                <CheckIcon className="h-[17px] w-[17px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span
                    className={`font-medium ${
                      goal.done
                        ? "text-[var(--text-tertiary)] line-through"
                        : "text-[var(--text)]"
                    }`}
                  >
                    <T en={goal.label ?? ""} uk={goal.label_uk} />
                  </span>
                  {href && (
                    <ArrowIcon className="h-4 w-4 shrink-0 -translate-x-1 text-[var(--text-tertiary)] opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                  )}
                </span>
                {goal.note && (
                  <span className="mt-0.5 block text-sm text-[var(--text-secondary)]">
                    <T en={goal.note} uk={goal.note_uk} />
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
                  <Link href={href} className={`${cardClass} press press-soft hover:bg-[var(--bg-hover)]`}>
                    {inner}
                  </Link>
                ) : (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className={`${cardClass} press press-soft hover:bg-[var(--bg-hover)]`}
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
