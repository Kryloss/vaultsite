"use client";

import { useSyncExternalStore } from "react";
import T from "@/components/T";
import { ui } from "@/lib/ui-strings";
import { chartRange, monthOf, type Span } from "@/lib/resume-span";

export interface ChartRow {
  role: string;
  roleUk?: string;
  org?: string;
  orgUk?: string;
  span: Span;
  /** Education draws in outline, work filled — the two strands of the page. */
  kind: "work" | "study";
}

const subscribe = () => () => {};

/**
 * The résumé at a glance — page idea `nowTimeline` (lib/site-config.ts,
 * DECISIONS #180). Every row with a period it can read (lib/resume-span.ts)
 * becomes a bar on a years axis, so what the list below says one row at a
 * time — school and work overlapping, one job handing over to the next, the
 * degree starting — is one picture above it.
 *
 * "Now" is the reader's month, not the build's: open bars run to it and the
 * marker stands on it. The static HTML is drawn at the build's month (the
 * server snapshot), so the chart has its full height from the first paint and
 * only its right-hand ends move, if at all, after hydration.
 */
export default function ResumeChart({
  rows,
  builtAt,
}: {
  rows: ChartRow[];
  builtAt: number;
}) {
  const now = useSyncExternalStore(
    subscribe,
    () => monthOf(new Date()),
    () => builtAt
  );
  const range = chartRange(
    rows.map((r) => r.span),
    now
  );
  if (!range) return null;

  const total = range.to - range.from;
  const at = (month: number) => `${((month - range.from) / total) * 100}%`;
  const years: number[] = [];
  for (let m = range.from; m <= range.to; m += 12) years.push(m / 12);

  return (
    <div className="mt-9 sm:grid sm:grid-cols-[104px_1fr] sm:gap-x-5">
      <h3 className="text-[11px] font-semibold uppercase leading-[1.4] tracking-[0.1em] text-[var(--text-tertiary)] sm:pt-[3px]">
        <T {...ui.resumeTimeline} />
      </h3>
      <div className="idea-rc mt-3 min-w-0 sm:mt-0">
        <div className="idea-rc-plot">
          {/* Year rules behind the bars. */}
          {years.map((y) => (
            <span
              key={y}
              className="idea-rc-year"
              style={{ left: at(y * 12) }}
              aria-hidden
            >
              {/* The closing rule has no year after it to name. */}
              {y * 12 < range.to && <span className="idea-rc-year-label">{y}</span>}
            </span>
          ))}
          <span className="idea-rc-now" style={{ left: at(now + 0.5) }} aria-hidden>
            <span className="idea-rc-now-label">
              <T {...ui.resumeNow} />
            </span>
          </span>

          <ol className="idea-rc-rows">
            {rows.map((row, i) => {
              const end = row.span.end ?? now;
              const open = row.span.end === null;
              return (
                <li key={i} className="idea-rc-row" style={{ "--i": i } as React.CSSProperties}>
                  <span className="idea-rc-name">
                    <T en={row.role} uk={row.roleUk} />
                    {row.org && (
                      <span className="idea-rc-org">
                        {" · "}
                        <T en={row.org} uk={row.orgUk} />
                      </span>
                    )}
                  </span>
                  <span className="idea-rc-track">
                    <span
                      className={`idea-rc-bar is-${row.kind}${open ? " is-open" : ""}`}
                      style={{
                        left: at(row.span.start),
                        width: `max(0.5rem, ${((end + 1 - row.span.start) / total) * 100}%)`,
                      }}
                    />
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}
