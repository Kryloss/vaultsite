"use client";

import { useEffect, useState } from "react";
import T from "@/components/T";
import { formatTime, localDate, type SharedDay } from "@/lib/routine-model";
import { ui } from "@/lib/ui-strings";

/**
 * A viewer's week: what `routine_shared_days()` returned and nothing more. There
 * is nothing here to hide, because a private item's details never reach this
 * browser. A null title is an item the owner didn't share, which reads as Busy.
 */
export default function RoutineShared() {
  const [days, setDays] = useState<SharedDay[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(`/api/routine/data?from=${localDate(new Date())}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const body = await response.json();
        setDays(body.days);
      })
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return (
      <p role="alert" className="routine-note">
        <T {...ui.routineErrorGeneric} />
      </p>
    );
  }

  if (!days) return null;

  const format = (iso: string, locale: string) =>
    new Intl.DateTimeFormat(locale, {
      weekday: "long",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${iso}T12:00:00Z`));

  return (
    <>
      {days.map((day) => (
        <section key={day.date}>
          <h2 className="routine-heading">
            <T en={format(day.date, "en-CA")} uk={format(day.date, "uk-UA")} />
          </h2>
          {day.blocks.length || day.tasks.length ? (
            <ul className="routine-plain">
              {day.blocks.map((block) => (
                <li key={`${block.start}-${block.end}`} className="routine-row">
                  <span className="routine-meta">
                    {formatTime(block.start)}–{formatTime(block.end)}
                  </span>
                  <span>{block.title ?? <T {...ui.routineBusy} />}</span>
                </li>
              ))}
              {day.tasks.map((task) => (
                <li key={task} className="routine-row">
                  <span className="routine-meta"><T {...ui.routineDue} /></span>
                  <span>{task}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="routine-note">
              <T {...ui.routineViewerEmpty} />
            </p>
          )}
        </section>
      ))}
    </>
  );
}
