import Link from "next/link";
import type { ReactNode } from "react";
import type { Section } from "@/lib/vault";
import { getAssetIndex, getWikiIndex } from "@/lib/vault";
import { DownloadIcon, MailIcon } from "@/components/icons";
import { ui } from "@/lib/ui-strings";
import T from "@/components/T";

/**
 * Résumé block, rendered under the Now cards from a `resume:` key in the
 * section's main.md frontmatter (same escape hatch the `music` type uses for
 * `playlists:` — see lib/vault.ts → Section.meta).
 *
 *   resume:
 *     summary: One-paragraph intro
 *     summary_uk: …
 *     file: Kyrylo Leshchenko Resume.pdf   # any file in the vault → download button
 *     experience:
 *       - role: Barista
 *         org: Starbucks
 *         meta: Upper Canada Mall, Newmarket   # location / sub-label
 *         period: Oct 2025 — present
 *         current: true                        # dot fills in, "Current" pill
 *         link: Some note                      # optional wiki target or URL
 *         points: ["Label — detail", …]        # the em dash splits lead-in from detail
 *     education: [ … same shape … ]
 *     certifications: [ … same shape … ]
 *     skills: ["Label — detail", …]
 *     languages: ["English — fluent", …]
 *     contact: { email, location, location_uk }
 *
 * Every field takes a `_uk` sibling (`role_uk`, `points_uk`, `skills_uk`, …);
 * where one is missing the English text renders in both languages, which is
 * exactly what we want for names like "Starbucks" or "CompTIA Security+".
 */

interface ResumeRow {
  role?: string;
  role_uk?: string;
  org?: string;
  org_uk?: string;
  meta?: string;
  meta_uk?: string;
  period?: string;
  period_uk?: string;
  note?: string;
  note_uk?: string;
  current?: boolean;
  link?: string;
  points?: string[];
  points_uk?: string[];
}

interface ResumeData {
  summary?: string;
  summary_uk?: string;
  file?: string;
  experience?: ResumeRow[];
  education?: ResumeRow[];
  certifications?: ResumeRow[];
  skills?: string[];
  skills_uk?: string[];
  languages?: string[];
  languages_uk?: string[];
  contact?: { email?: string; location?: string; location_uk?: string };
}

export default function Resume({ section }: { section: Section }) {
  const data = section.meta.resume as ResumeData | undefined;
  if (!data) return null;

  const fileUrl = data.file
    ? getAssetIndex().get(data.file.trim().toLowerCase())
    : undefined;

  return (
    <section className="mt-16 border-t border-[var(--border)] pt-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--text)]">
          <T {...ui.resume} />
        </h2>
        {fileUrl && (
          <a
            href={fileUrl}
            download
            className="group inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
          >
            <DownloadIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-y-px" />
            <T {...ui.resumeDownload} />
          </a>
        )}
      </header>

      {data.summary && (
        <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-[var(--text-secondary)]">
          <T en={data.summary} uk={data.summary_uk} />
        </p>
      )}

      {data.experience?.length ? (
        <Block label={<T {...ui.resumeExperience} />}>
          <Timeline rows={data.experience} badge />
        </Block>
      ) : null}

      {data.education?.length ? (
        <Block label={<T {...ui.resumeEducation} />}>
          <Timeline rows={data.education} />
        </Block>
      ) : null}

      {data.certifications?.length ? (
        <Block label={<T {...ui.resumeCertifications} />}>
          <Timeline rows={data.certifications} />
        </Block>
      ) : null}

      {data.skills?.length ? (
        <Block label={<T {...ui.resumeSkills} />}>
          <ul className="flex flex-col gap-2.5">
            {data.skills.map((s, i) => (
              <li key={i} className="text-sm leading-relaxed">
                <Point en={s} uk={data.skills_uk?.[i]} />
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      {data.languages?.length ? (
        <Block label={<T {...ui.resumeLanguages} />}>
          <ul className="flex flex-wrap gap-2">
            {data.languages.map((l, i) => (
              <li
                key={i}
                className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-secondary)]"
              >
                <T en={l} uk={data.languages_uk?.[i]} />
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      {data.contact?.email && (
        <Block label={<T {...ui.resumeContact} />}>
          <a
            href={`mailto:${data.contact.email}`}
            className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] underline decoration-[var(--text-tertiary)] underline-offset-4 transition-colors hover:text-[var(--text)]"
          >
            <MailIcon className="h-4 w-4" />
            {data.contact.email}
          </a>
          {data.contact.location && (
            <p className="mt-1.5 text-sm text-[var(--text-tertiary)]">
              <T en={data.contact.location} uk={data.contact.location_uk} />
            </p>
          )}
        </Block>
      )}
    </section>
  );
}

/** Small-caps label in a left column on wide screens, stacked on mobile. */
function Block({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="mt-9 sm:grid sm:grid-cols-[104px_1fr] sm:gap-x-5">
      <h3 className="text-[11px] font-semibold uppercase leading-[1.4] tracking-[0.1em] text-[var(--text-tertiary)] sm:pt-[3px]">
        {label}
      </h3>
      <div className="mt-3 min-w-0 sm:mt-0">{children}</div>
    </div>
  );
}

/**
 * `badge` adds the "Current" pill next to whatever is ongoing. Experience wants
 * it; education and certifications already say "From Sept 2026" / "In progress"
 * in their own period column, so there the filled dot carries it alone.
 */
function Timeline({ rows, badge = false }: { rows: ResumeRow[]; badge?: boolean }) {
  const wiki = getWikiIndex();
  const hrefFor = (link?: string): string | undefined => {
    if (!link) return undefined;
    if (/^(https?:|mailto:)/i.test(link)) return link;
    return wiki.get(link.trim().toLowerCase());
  };

  return (
    <ol className="flex flex-col gap-7 border-l border-[var(--border)] pl-5">
      {rows.map((row, i) => {
        const href = hrefFor(row.link);
        const title = (
          <>
            <T en={row.role ?? ""} uk={row.role_uk} />
            {row.org && (
              <span className="text-[var(--text-secondary)]">
                {" · "}
                <T en={row.org} uk={row.org_uk} />
              </span>
            )}
          </>
        );

        return (
          <li key={i} className="relative">
            {/* Dot sits on the rule: filled for what's current, hollow for the past. */}
            <span
              aria-hidden
              className={`absolute -left-[25.5px] top-[7px] h-[9px] w-[9px] rounded-full border ring-4 ring-[var(--bg)] ${
                row.current
                  ? "border-[var(--text)] bg-[var(--text)]"
                  : "border-[var(--text-tertiary)] bg-[var(--bg)]"
              }`}
            />
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <h4 className="font-medium text-[var(--text)]">
                {href ? (
                  <MaybeLink href={href}>{title}</MaybeLink>
                ) : (
                  title
                )}
                {badge && row.current && (
                  <span className="ml-2 align-[2px] rounded-full bg-[var(--bg-hover)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
                    <T {...ui.resumeCurrent} />
                  </span>
                )}
              </h4>
              {row.period && (
                <span className="shrink-0 text-xs text-[var(--text-tertiary)]">
                  <T en={row.period} uk={row.period_uk} />
                </span>
              )}
            </div>

            {(row.meta || row.note) && (
              <p className="mt-0.5 text-[13px] text-[var(--text-tertiary)]">
                <T en={row.meta ?? row.note ?? ""} uk={row.meta_uk ?? row.note_uk} />
              </p>
            )}

            {row.points?.length ? (
              <ul className="mt-2.5 flex flex-col gap-2">
                {row.points.map((p, j) => (
                  <li key={j} className="relative pl-4 text-sm leading-relaxed">
                    <span
                      aria-hidden
                      className="absolute left-0 top-[9px] h-[3px] w-[3px] rounded-full bg-[var(--text-tertiary)]"
                    />
                    <Point en={p} uk={row.points_uk?.[j]} />
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function MaybeLink({ href, children }: { href: string; children: ReactNode }) {
  const cls = "transition-colors hover:text-[var(--text-secondary)]";
  return href.startsWith("/") ? (
    <Link href={href} className={cls}>
      {children}
    </Link>
  ) : (
    <a href={href} target="_blank" rel="noreferrer" className={cls}>
      {children}
    </a>
  );
}

/**
 * "Label — detail" renders the lead-in in the primary text colour and the rest
 * secondary; a line with no em dash just renders as secondary text.
 */
function Point({ en, uk }: { en: string; uk?: string }) {
  return <T en={splitPoint(en)} uk={uk ? splitPoint(uk) : undefined} />;
}

function splitPoint(text: string): ReactNode {
  const i = text.indexOf(" — ");
  if (i === -1) return <span className="text-[var(--text-secondary)]">{text}</span>;
  return (
    <>
      <span className="font-medium text-[var(--text)]">{text.slice(0, i)}</span>
      {/* slice from the space, not past it, so the dash keeps its breathing room */}
      <span className="text-[var(--text-secondary)]">{text.slice(i)}</span>
    </>
  );
}
