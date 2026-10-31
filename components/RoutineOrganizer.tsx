"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import T from "@/components/T";
import { overdueCount } from "@/lib/plural";
import {
  addDays,
  blocksOn,
  formatTime,
  habitsOn,
  localDate,
  overdueTasks,
  parseTime,
  tasksOn,
  weekdayOf,
  weekStart,
  type Block,
  type Change,
  type Habit,
  type ItemKind,
  type RoutineData,
  type Task,
} from "@/lib/routine-model";
import { ui, type Str } from "@/lib/ui-strings";

/**
 * The owner's organizer. Rendered by `RoutineAccess` only once the server has
 * said this visitor is the owner, and everything it reads comes through
 * `/api/routine/data`, which asks again. Ticks change the screen first and reload
 * after, because a checkbox that waits for the network feels broken on a phone.
 */

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

function formatted(iso: string, options: Intl.DateTimeFormatOptions): Str {
  const date = new Date(`${iso}T12:00:00Z`);
  const format = (locale: string) =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(date);
  return { en: format("en-CA"), uk: format("uk-UA") };
}

/** An instant, so this one does pass through the reader's time zone. */
function syncedTime(at: string): Str {
  const date = new Date(at);
  const format = (locale: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
  return { en: format("en-CA"), uk: format("uk-UA") };
}

/** Any Monday plus its weekday gives that weekday's name. */
function weekdayName(weekday: number): Str {
  return formatted(addDays("2026-11-02", weekday - 1), { weekday: "short" });
}

function range(block: { start_min: number; end_min: number }): string {
  return `${formatTime(block.start_min)}–${formatTime(block.end_min)}`;
}

async function send(body: unknown): Promise<boolean> {
  try {
    const response = await fetch("/api/routine/item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function Field({ label, children }: { label: Str; children: ReactNode }) {
  return (
    <label>
      <span><T {...label} /></span>
      {children}
    </label>
  );
}

interface FormProps {
  today: string;
  date: string;
  onSave: (body: unknown) => Promise<boolean>;
  onClose: () => void;
}

function Actions({
  busy,
  failed,
  onClose,
  onRemove,
}: {
  busy: boolean;
  failed: boolean;
  onClose: () => void;
  onRemove?: () => void;
}) {
  return (
    <>
      {failed ? (
        <p role="alert" className="routine-note">
          <T {...ui.routineErrorInvalid} />
        </p>
      ) : null}
      <div className="routine-actions">
        <button type="submit" disabled={busy} className="routine-btn press">
          <T {...ui.routineSave} />
        </button>
        <button type="button" onClick={onClose} className="routine-btn press">
          <T {...ui.routineCancel} />
        </button>
        {onRemove ? (
          <button type="button" disabled={busy} onClick={onRemove} className="routine-btn press">
            <T {...ui.routineRemove} />
          </button>
        ) : null}
      </div>
    </>
  );
}

function BlockForm({ item, date, onSave, onClose }: FormProps & { item?: Block }) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [weekly, setWeekly] = useState(item ? item.weekday !== null : true);
  const [weekday, setWeekday] = useState(item?.weekday ?? weekdayOf(date));
  const [onDate, setOnDate] = useState(item?.on_date ?? date);
  const [start, setStart] = useState(item ? formatTime(item.start_min) : "09:00");
  const [end, setEnd] = useState(item ? formatTime(item.end_min) : "10:00");
  const [location, setLocation] = useState(item?.location ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [shareable, setShareable] = useState(item?.shareable ?? false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function run(body: unknown) {
    setBusy(true);
    const saved = await onSave(body);
    setBusy(false);
    if (saved) onClose();
    else setFailed(true);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void run({
      action: "save",
      kind: "block",
      id: item?.id ?? null,
      values: {
        title,
        weekday: weekly ? weekday : null,
        on_date: weekly ? null : onDate,
        start_min: parseTime(start),
        end_min: parseTime(end),
        location,
        notes,
        shareable,
      },
    });
  }

  return (
    <form className="routine-form routine-card" onSubmit={submit}>
      <Field label={ui.routineFieldTitle}>
        <input
          className="routine-input"
          required
          maxLength={200}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </Field>
      <fieldset>
        <legend><T {...ui.routineFieldRepeats} /></legend>
        <div className="routine-days">
          <label>
            <input type="radio" name="repeats" checked={weekly} onChange={() => setWeekly(true)} />
            <T {...ui.routineEveryWeek} />
          </label>
          <label>
            <input type="radio" name="repeats" checked={!weekly} onChange={() => setWeekly(false)} />
            <T {...ui.routineOneDate} />
          </label>
        </div>
      </fieldset>
      {weekly ? (
        <div className="routine-days">
          {WEEKDAYS.map((day) => (
            <label key={day}>
              <input
                type="radio"
                name="weekday"
                checked={weekday === day}
                onChange={() => setWeekday(day)}
              />
              <T {...weekdayName(day)} />
            </label>
          ))}
        </div>
      ) : (
        <Field label={ui.routineFieldDate}>
          <input
            className="routine-input"
            type="date"
            required
            value={onDate}
            onChange={(event) => setOnDate(event.target.value)}
          />
        </Field>
      )}
      <div className="routine-pair">
        <Field label={ui.routineFieldStart}>
          <input
            className="routine-input"
            type="time"
            required
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </Field>
        <Field label={ui.routineFieldEnd}>
          <input
            className="routine-input"
            type="time"
            required
            value={end}
            onChange={(event) => setEnd(event.target.value)}
          />
        </Field>
      </div>
      <Field label={ui.routineFieldLocation}>
        <input
          className="routine-input"
          maxLength={200}
          value={location}
          onChange={(event) => setLocation(event.target.value)}
        />
      </Field>
      <Field label={ui.routineFieldNotes}>
        <textarea
          className="routine-input"
          rows={2}
          maxLength={2000}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </Field>
      <div className="routine-days">
        <label>
          <input
            type="checkbox"
            checked={shareable}
            onChange={(event) => setShareable(event.target.checked)}
          />
          <T {...ui.routineShareBlock} />
        </label>
      </div>
      <Actions
        busy={busy}
        failed={failed}
        onClose={onClose}
        onRemove={item ? () => run({ action: "archive", kind: "block", id: item.id }) : undefined}
      />
    </form>
  );
}

function TaskForm({ item, date, onSave, onClose }: FormProps & { item?: Task }) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [dueOn, setDueOn] = useState(item ? (item.due_on ?? "") : date);
  const [dueTime, setDueTime] = useState(item?.due_min != null ? formatTime(item.due_min) : "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [shareable, setShareable] = useState(item?.shareable ?? false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function run(body: unknown) {
    setBusy(true);
    const saved = await onSave(body);
    setBusy(false);
    if (saved) onClose();
    else setFailed(true);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void run({
      action: "save",
      kind: "task",
      id: item?.id ?? null,
      values: {
        title,
        due_on: dueOn || null,
        due_min: dueOn && dueTime ? parseTime(dueTime) : null,
        notes,
        shareable,
      },
    });
  }

  return (
    <form className="routine-form routine-card" onSubmit={submit}>
      <Field label={ui.routineFieldTitle}>
        <input
          className="routine-input"
          required
          maxLength={200}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </Field>
      <div className="routine-pair">
        <Field label={ui.routineFieldDue}>
          <input
            className="routine-input"
            type="date"
            value={dueOn}
            onChange={(event) => setDueOn(event.target.value)}
          />
        </Field>
        <Field label={ui.routineFieldDueTime}>
          <input
            className="routine-input"
            type="time"
            disabled={!dueOn}
            value={dueTime}
            onChange={(event) => setDueTime(event.target.value)}
          />
        </Field>
      </div>
      <Field label={ui.routineFieldNotes}>
        <textarea
          className="routine-input"
          rows={2}
          maxLength={2000}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </Field>
      <div className="routine-days">
        <label>
          <input
            type="checkbox"
            checked={shareable}
            onChange={(event) => setShareable(event.target.checked)}
          />
          <T {...ui.routineShareTask} />
        </label>
      </div>
      <Actions
        busy={busy}
        failed={failed}
        onClose={onClose}
        onRemove={item ? () => run({ action: "archive", kind: "task", id: item.id }) : undefined}
      />
    </form>
  );
}

function HabitForm({ item, onSave, onClose }: FormProps & { item?: Habit }) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [weekdays, setWeekdays] = useState<number[]>(item?.weekdays ?? WEEKDAYS);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function run(body: unknown) {
    setBusy(true);
    const saved = await onSave(body);
    setBusy(false);
    if (saved) onClose();
    else setFailed(true);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void run({
      action: "save",
      kind: "habit",
      id: item?.id ?? null,
      values: { title, weekdays },
    });
  }

  return (
    <form className="routine-form routine-card" onSubmit={submit}>
      <Field label={ui.routineFieldTitle}>
        <input
          className="routine-input"
          required
          maxLength={200}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </Field>
      <fieldset>
        <legend><T {...ui.routineFieldDays} /></legend>
        <div className="routine-days">
          {WEEKDAYS.map((day) => (
            <label key={day}>
              <input
                type="checkbox"
                checked={weekdays.includes(day)}
                onChange={(event) =>
                  setWeekdays(
                    event.target.checked
                      ? [...weekdays, day]
                      : weekdays.filter((other) => other !== day)
                  )
                }
              />
              <T {...weekdayName(day)} />
            </label>
          ))}
        </div>
      </fieldset>
      <Actions
        busy={busy}
        failed={failed}
        onClose={onClose}
        onRemove={item ? () => run({ action: "archive", kind: "habit", id: item.id }) : undefined}
      />
    </form>
  );
}

function noteError(code: string | undefined): Str {
  if (code === "gemini_off") return ui.routineGeminiOff;
  if (code === "daily_limit") return ui.routineGeminiLimit;
  if (code === "gemini_bad") return ui.routineGeminiBad;
  return ui.routineErrorGeneric;
}

/** Type anything; Gemini changes the routine straight away, and one press takes it all back. */
function NoteBox({ onOrganized, onUndo }: { onOrganized: () => void; onUndo: (batch: string) => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Str | null>(null);
  const [result, setResult] = useState<{ message: string; batch: string | null } | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/routine/organize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const body = await response.json();
      if (response.ok) {
        setResult(body);
        setNote("");
        onOrganized();
      } else {
        setError(noteError(body.error));
      }
    } catch {
      setError(ui.routineErrorGeneric);
    }
    setBusy(false);
  }

  return (
    <form className="routine-note-box" onSubmit={submit}>
      <label htmlFor="routine-note"><T {...ui.routineNoteLabel} /></label>
      <textarea
        id="routine-note"
        className="routine-input"
        required
        rows={3}
        maxLength={4000}
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <div className="routine-actions">
        <button type="submit" disabled={busy} className="routine-btn press">
          <T {...(busy ? ui.routineOrganizing : ui.routineOrganize)} />
        </button>
      </div>
      {error ? (
        <p role="alert" className="routine-note">
          <T {...error} />
        </p>
      ) : null}
      {result ? (
        <div role="status" className="routine-history-row routine-note">
          <span>{result.message}</span>
          {result.batch ? (
            <button
              type="button"
              onClick={() => {
                onUndo(result.batch as string);
                setResult(null);
              }}
              className="routine-btn press"
            >
              <T {...ui.routineUndo} />
            </button>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

function History({ changes, onUndo }: { changes: Change[]; onUndo: (id: number) => void }) {
  const actors: Record<string, Str> = {
    owner: ui.routineByYou,
    gemini: ui.routineByGemini,
    uni: ui.routineByUni,
  };

  return (
    <details className="routine-history">
      <summary><T {...ui.routineHistory} /></summary>
      {changes.length ? (
        <ul className="routine-list">
          {changes.map((change) => (
            <li key={change.id} className="routine-history-row">
              <span>
                <T {...(change.op === "insert" ? ui.routineAdded : ui.routineChanged)} />{" "}
                {change.title}
                <span className="routine-meta">
                  {" · "}
                  <T {...(actors[change.actor] ?? ui.routineByYou)} />
                </span>
              </span>
              <button type="button" onClick={() => onUndo(change.id)} className="routine-btn press">
                <T {...ui.routineUndo} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="routine-note">
          <T {...ui.routineNoHistory} />
        </p>
      )}
    </details>
  );
}

function DayLogBox({
  date,
  saved,
  onSave,
}: {
  date: string;
  saved: string;
  onSave: (body: string) => void;
}) {
  const [draft, setDraft] = useState(saved);
  const lastSaved = useRef(saved);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function save(body: string) {
    clearTimeout(timer.current);
    if (body === lastSaved.current) return;
    lastSaved.current = body;
    onSave(body);
  }

  // A phone can leave the page without the box ever losing focus, so typing
  // saves by itself a moment after it stops, and blur only finishes the job.
  return (
    <textarea
      className="routine-input"
      aria-labelledby={`routine-log-${date}`}
      rows={3}
      maxLength={5000}
      value={draft}
      onChange={(event) => {
        const body = event.target.value;
        setDraft(body);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => save(body), 1000);
      }}
      onBlur={() => save(draft)}
    />
  );
}

export default function RoutineOrganizer({ access }: { access: ReactNode }) {
  const [opened] = useState(() => new Date());
  const today = localDate(opened);
  const nowMinute = opened.getHours() * 60 + opened.getMinutes();

  const [date, setDate] = useState(today);
  const [view, setView] = useState<"day" | "week" | "access">("day");
  const [data, setData] = useState<RoutineData | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState<
    { kind: ItemKind; item?: Block | Task | Habit } | null
  >(null);

  const week = weekStart(date);

  const load = useCallback(() => {
    fetch(`/api/routine/data?from=${week}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setData(await response.json());
      })
      .catch(() => setFailed(true));
  }, [week]);

  useEffect(load, [load]);

  async function act(body: unknown): Promise<boolean> {
    const saved = await send(body);
    setFailed(!saved);
    load();
    return saved;
  }

  const form: FormProps = { today, date, onSave: act, onClose: () => setEditing(null) };

  const tabs: [typeof view, Str][] = [
    ["day", ui.routineTabDay],
    ["week", ui.routineTabWeek],
    ["access", ui.routineTabAccess],
  ];

  const header = (
    <div className="routine-tabs">
      {tabs.map(([tab, label]) => (
        <button
          key={tab}
          type="button"
          aria-pressed={view === tab}
          onClick={() => {
            setView(tab);
            setEditing(null);
          }}
          className="routine-tab press"
        >
          <T {...label} />
        </button>
      ))}
    </div>
  );

  if (view === "access") {
    return (
      <>
        {header}
        {access}
      </>
    );
  }

  const alert = failed ? (
    <p role="alert" className="routine-note">
      <T {...ui.routineErrorGeneric} />
    </p>
  ) : null;

  if (!data) {
    return (
      <>
        {header}
        {alert}
      </>
    );
  }

  const stepper = (step: number) => (
    <div className="routine-stepper">
      <button
        type="button"
        onClick={() => setDate(addDays(date, -step))}
        className="routine-btn press"
      >
        <span aria-hidden="true">‹</span>
        <span className="sr-only"><T {...ui.routinePrevious} /></span>
      </button>
      {date !== today ? (
        <button type="button" onClick={() => setDate(today)} className="routine-btn press">
          <T {...ui.routineTabDay} />
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => setDate(addDays(date, step))}
        className="routine-btn press"
      >
        <span aria-hidden="true">›</span>
        <span className="sr-only"><T {...ui.routineNext} /></span>
      </button>
    </div>
  );

  if (view === "week") {
    return (
      <>
        {header}
        {alert}
        <div className="routine-day-head">
          <h2 className="routine-heading">
            <T {...formatted(week, { month: "long", day: "numeric" })} />
          </h2>
          {stepper(7)}
        </div>
        <div className="routine-week">
          {WEEKDAYS.map((_, index) => {
            const day = addDays(week, index);
            const dayBlocks = blocksOn(data.blocks, day);
            const dayTasks = tasksOn(data.tasks, day, today).filter((task) => !task.done_at);
            return (
              <button
                key={day}
                type="button"
                aria-current={day === today ? "date" : undefined}
                onClick={() => {
                  setDate(day);
                  setView("day");
                }}
                className="routine-week-day press press-soft"
              >
                <span className="routine-card-title">
                  <T {...formatted(day, { weekday: "short", day: "numeric" })} />
                </span>
                {dayBlocks.map((block) => (
                  <span key={block.id} className="routine-week-line">
                    <span className="routine-meta">{formatTime(block.start_min)}</span> {block.title}
                  </span>
                ))}
                {dayTasks.map((task) => (
                  <span key={task.id} className="routine-week-line">
                    {task.title}
                  </span>
                ))}
              </button>
            );
          })}
        </div>
      </>
    );
  }

  const dayBlocks = blocksOn(data.blocks, date);
  const dayTasks = tasksOn(data.tasks, date, today);
  const overdue = date === today ? overdueTasks(data.tasks, today) : [];
  const dayHabits = habitsOn(data.habits, date);
  const log = data.logs.find((entry) => entry.on_date === date)?.body ?? "";

  function setTaskDone(task: Task, done: boolean) {
    setData((current) =>
      current && {
        ...current,
        tasks: current.tasks.map((other) =>
          other.id === task.id
            ? { ...other, done_at: done ? new Date().toISOString() : null }
            : other
        ),
      }
    );
    void act({ action: "done", id: task.id, done });
  }

  function setHabitDone(habit: Habit, checked: boolean) {
    setData((current) =>
      current && {
        ...current,
        checks: checked
          ? [...current.checks, { habit_id: habit.id, on_date: date }]
          : current.checks.filter(
              (check) => !(check.habit_id === habit.id && check.on_date === date)
            ),
      }
    );
    void act({ action: "check", habit_id: habit.id, on_date: date, checked });
  }

  return (
    <>
      {header}
      {alert}

      <NoteBox
        onOrganized={load}
        onUndo={(batch) => void act({ action: "undo_note", batch })}
      />

      <div className="routine-day-head">
        <h2 className="routine-heading">
          <T {...formatted(date, { weekday: "long", month: "long", day: "numeric" })} />
        </h2>
        {stepper(1)}
      </div>

      {overdue.length ? (
        <div className="routine-card routine-overdue">
          <p className="routine-card-title">
            <T {...overdueCount(overdue.length)} />
          </p>
          <ul className="routine-plain">
            {overdue.slice(0, 3).map((task) => (
              <li key={task.id} className="routine-note">{task.title}</li>
            ))}
          </ul>
          <div className="routine-actions">
            <button
              type="button"
              onClick={() =>
                void act({
                  action: "reschedule",
                  ids: overdue.map((task) => task.id),
                  due_on: today,
                })
              }
              className="routine-btn press"
            >
              <T {...ui.routineMoveToToday} />
            </button>
          </div>
        </div>
      ) : null}

      <h3 className="routine-subheading"><T {...ui.routineSchedule} /></h3>
      {dayBlocks.length ? (
        <ul className="routine-plain">
          {dayBlocks.map((block) => {
            const current =
              date === today && block.start_min <= nowMinute && nowMinute < block.end_min;
            return (
              <li key={block.id}>
                <button
                  type="button"
                  aria-current={current ? "time" : undefined}
                  onClick={() => setEditing({ kind: "block", item: block })}
                  className="routine-row press press-soft"
                >
                  <span className="routine-meta">{range(block)}</span>
                  <span>
                    {block.title}
                    {block.location ? (
                      <span className="routine-meta"> · {block.location}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="routine-note"><T {...ui.routineNothingPlanned} /></p>
      )}

      <h3 className="routine-subheading"><T {...ui.routineTasks} /></h3>
      {dayTasks.length ? (
        <ul className="routine-plain">
          {dayTasks.map((task) => (
            <li key={task.id} className="routine-check">
              <input
                type="checkbox"
                checked={!!task.done_at}
                aria-label={task.title}
                onChange={(event) => setTaskDone(task, event.target.checked)}
              />
              <button
                type="button"
                onClick={() => setEditing({ kind: "task", item: task })}
                data-done={task.done_at ? "" : undefined}
                className="routine-check-title press"
              >
                {task.due_min !== null ? (
                  <span className="routine-meta">{formatTime(task.due_min)} </span>
                ) : null}
                {task.title}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="routine-note"><T {...ui.routineNoTasks} /></p>
      )}

      <h3 className="routine-subheading"><T {...ui.routineHabits} /></h3>
      {dayHabits.length ? (
        <ul className="routine-plain">
          {dayHabits.map((habit) => {
            const checked = data.checks.some(
              (check) => check.habit_id === habit.id && check.on_date === date
            );
            return (
              <li key={habit.id} className="routine-check">
                <input
                  type="checkbox"
                  checked={checked}
                  aria-label={habit.title}
                  onChange={(event) => setHabitDone(habit, event.target.checked)}
                />
                <button
                  type="button"
                  onClick={() => setEditing({ kind: "habit", item: habit })}
                  data-done={checked ? "" : undefined}
                  className="routine-check-title press"
                >
                  {habit.title}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="routine-note"><T {...ui.routineNoHabits} /></p>
      )}

      <h3 id={`routine-log-${date}`} className="routine-subheading">
        <T {...ui.routineLog} />
      </h3>
      <DayLogBox
        key={date}
        date={date}
        saved={log}
        onSave={(body) => void act({ action: "log", on_date: date, body })}
      />

      {editing ? (
        <div className="routine-editor">
          {editing.kind === "block" ? (
            <BlockForm key={editing.item?.id} {...form} item={editing.item as Block | undefined} />
          ) : editing.kind === "task" ? (
            <TaskForm key={editing.item?.id} {...form} item={editing.item as Task | undefined} />
          ) : (
            <HabitForm key={editing.item?.id} {...form} item={editing.item as Habit | undefined} />
          )}
        </div>
      ) : (
        <div className="routine-actions">
          <button
            type="button"
            onClick={() => setEditing({ kind: "block" })}
            className="routine-btn press"
          >
            <T {...ui.routineAddBlock} />
          </button>
          <button
            type="button"
            onClick={() => setEditing({ kind: "task" })}
            className="routine-btn press"
          >
            <T {...ui.routineAddTask} />
          </button>
          <button
            type="button"
            onClick={() => setEditing({ kind: "habit" })}
            className="routine-btn press"
          >
            <T {...ui.routineAddHabit} />
          </button>
        </div>
      )}

      <History
        changes={data.changes}
        onUndo={(id) => void act({ action: "undo", change: id })}
      />

      {data.syncedAt ? (
        <p className="routine-note">
          <T {...ui.routineSynced} /> <T {...syncedTime(data.syncedAt)} />
        </p>
      ) : null}
    </>
  );
}
