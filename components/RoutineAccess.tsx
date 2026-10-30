"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import RoutineOrganizer from "@/components/RoutineOrganizer";
import RoutineShared from "@/components/RoutineShared";
import T from "@/components/T";
import { dayCount } from "@/lib/plural";
import {
  DAY_CHOICES,
  DEFAULT_DAYS,
  MAX_REASON,
  MAX_RELATIONSHIP,
  type AccessError,
  type ActiveViewer,
  type PendingRequest,
  type RoutineStatus,
} from "@/lib/routine-access";
import { ui, type Str } from "@/lib/ui-strings";

/**
 * Everything on /routine that depends on who is looking. The page itself is
 * static and holds nothing private, so this asks `/api/routine/status` after
 * hydration; the session cookie is httpOnly and scoped to those routes, so the
 * browser couldn't work it out alone. Until the answer arrives it draws nothing,
 * rather than offering Log in to someone who is signed in.
 */

async function fetchStatus(): Promise<RoutineStatus> {
  try {
    const response = await fetch("/api/routine/status", { cache: "no-store" });
    return await response.json();
  } catch {
    return { role: "unavailable" };
  }
}

async function post(url: string, body: unknown): Promise<AccessError | null> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) return null;
    const { error } = await response.json();
    return error ?? "unknown";
  } catch {
    return "unknown";
  }
}

function errorText(code: AccessError): Str {
  if (code === "cooldown") return ui.routineErrorCooldown;
  if (code === "daily_limit") return ui.routineErrorDaily;
  if (code === "already_pending") return ui.routinePending;
  if (code === "invalid_request") return ui.routineErrorInvalid;
  return ui.routineErrorGeneric;
}

function until(iso: string): Str {
  const date = new Date(iso);
  const format = (locale: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" }).format(date);
  return {
    en: ui.routineUntil.en.replace("{date}", format("en-CA")),
    uk: ui.routineUntil.uk.replace("{date}", format("uk-UA")),
  };
}

function SignOut({ email }: { email?: string }) {
  return (
    <form method="post" action="/api/routine/auth/logout" className="routine-account">
      {email ? <span>{email}</span> : null}
      <button type="submit" className="routine-btn press">
        <T {...ui.routineSignOut} />
      </button>
    </form>
  );
}

function DayChoices({
  name,
  value,
  onChange,
}: {
  name: string;
  value: number;
  onChange: (days: number) => void;
}) {
  return (
    <div className="routine-days">
      {DAY_CHOICES.map((days) => (
        <label key={days}>
          <input
            type="radio"
            name={name}
            checked={value === days}
            onChange={() => onChange(days)}
          />
          <T {...dayCount(days)} />
        </label>
      ))}
    </div>
  );
}

function RequestForm({ onSent }: { onSent: () => void }) {
  const [relationship, setRelationship] = useState("");
  const [reason, setReason] = useState("");
  const [days, setDays] = useState<number>(DEFAULT_DAYS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AccessError | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const refused = await post("/api/routine/request", { relationship, reason, days });
    setBusy(false);
    if (refused) setError(refused);
    else onSent();
  }

  return (
    <form className="routine-form" onSubmit={submit}>
      <label>
        <span><T {...ui.routineRelationship} /></span>
        <input
          className="routine-input"
          required
          maxLength={MAX_RELATIONSHIP}
          value={relationship}
          onChange={(event) => setRelationship(event.target.value)}
        />
      </label>
      <label>
        <span><T {...ui.routineReason} /></span>
        <textarea
          className="routine-input"
          required
          rows={4}
          maxLength={MAX_REASON}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <fieldset>
        <legend><T {...ui.routineHowLong} /></legend>
        <DayChoices name="days" value={days} onChange={setDays} />
      </fieldset>
      {error ? (
        <p role="alert" className="routine-note">
          <T {...errorText(error)} />
        </p>
      ) : null}
      <div className="routine-actions">
        <button type="submit" disabled={busy} className="routine-btn press">
          <T {...ui.routineSend} />
        </button>
      </div>
    </form>
  );
}

function RequestCard({ request, onDone }: { request: PendingRequest; onDone: () => void }) {
  const [days, setDays] = useState(request.days);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AccessError | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    const refused = await post("/api/routine/decide", { id: request.id, approve, days });
    setBusy(false);
    if (refused) setError(refused);
    else onDone();
  }

  return (
    <li className="routine-card">
      <p className="routine-card-title">{request.displayName || request.email}</p>
      {request.displayName ? <p className="routine-note">{request.email}</p> : null}
      <dl>
        <dt><T {...ui.routineRelationship} /></dt>
        <dd>{request.relationship}</dd>
        <dt><T {...ui.routineReason} /></dt>
        <dd>{request.reason}</dd>
      </dl>
      <DayChoices name={`days-${request.id}`} value={days} onChange={setDays} />
      {error ? (
        <p role="alert" className="routine-note">
          <T {...errorText(error)} />
        </p>
      ) : null}
      <div className="routine-actions">
        <button
          type="button"
          disabled={busy}
          onClick={() => decide(true)}
          className="routine-btn press"
        >
          <T {...ui.routineApprove} />
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => decide(false)}
          className="routine-btn press"
        >
          <T {...ui.routineDeny} />
        </button>
      </div>
    </li>
  );
}

function ViewerCard({ viewer, onDone }: { viewer: ActiveViewer; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AccessError | null>(null);

  async function revoke() {
    setBusy(true);
    const refused = await post("/api/routine/revoke", { id: viewer.id });
    setBusy(false);
    if (refused) setError(refused);
    else onDone();
  }

  return (
    <li className="routine-card">
      <p className="routine-card-title">{viewer.displayName || viewer.email}</p>
      <p className="routine-note">
        <T {...until(viewer.expiresAt)} />
      </p>
      {error ? (
        <p role="alert" className="routine-note">
          <T {...errorText(error)} />
        </p>
      ) : null}
      <div className="routine-actions">
        <button type="button" disabled={busy} onClick={revoke} className="routine-btn press">
          <T {...ui.routineRevoke} />
        </button>
      </div>
    </li>
  );
}

function OwnerPanel({
  pending,
  active,
  onChange,
}: {
  pending: PendingRequest[];
  active: ActiveViewer[];
  onChange: () => void;
}) {
  return (
    <>
      <h2 className="routine-heading">
        <T {...ui.routineRequests} />
      </h2>
      {pending.length ? (
        <ul className="routine-list">
          {pending.map((request) => (
            <RequestCard key={request.id} request={request} onDone={onChange} />
          ))}
        </ul>
      ) : (
        <p className="routine-note">
          <T {...ui.routineNoRequests} />
        </p>
      )}
      <h2 className="routine-heading">
        <T {...ui.routineViewers} />
      </h2>
      {active.length ? (
        <ul className="routine-list">
          {active.map((viewer) => (
            <ViewerCard key={viewer.id} viewer={viewer} onDone={onChange} />
          ))}
        </ul>
      ) : (
        <p className="routine-note">
          <T {...ui.routineNoViewers} />
        </p>
      )}
      <SignOut />
    </>
  );
}

export default function RoutineAccess() {
  const [status, setStatus] = useState<RoutineStatus | null>(null);

  const load = useCallback(() => {
    void fetchStatus().then(setStatus);
  }, []);

  useEffect(load, [load]);

  if (!status) return null;

  switch (status.role) {
    case "unavailable":
      return (
        <p role="status" className="routine-note">
          <T {...ui.routineUnavailable} />
        </p>
      );
    case "signedOut":
      return (
        <>
          {new URLSearchParams(window.location.search).get("signin") === "failed" ? (
            <p role="alert" className="routine-note">
              <T {...ui.routineSignInFailed} />
            </p>
          ) : null}
          <form method="post" action="/api/routine/auth/login" className="routine-actions">
            <button type="submit" className="routine-btn press">
              <T {...ui.routineLogIn} />
            </button>
            <button type="submit" className="routine-btn press">
              <T {...ui.routineRequestAccess} />
            </button>
          </form>
        </>
      );
    case "unverified":
      return (
        <>
          <p role="status" className="routine-note">
            <T {...ui.routineUnverified} />
          </p>
          <SignOut />
        </>
      );
    case "none":
      return (
        <>
          <p className="routine-note">
            <T {...ui.routineRequestIntro} />
          </p>
          <RequestForm onSent={load} />
          <SignOut email={status.email} />
        </>
      );
    case "pending":
      return (
        <>
          <p role="status" className="routine-note">
            <T {...ui.routinePending} />
          </p>
          <SignOut email={status.email} />
        </>
      );
    case "denied":
      return (
        <>
          <p role="status" className="routine-note">
            <T {...ui.routineDenied} />
          </p>
          <SignOut email={status.email} />
        </>
      );
    case "viewer":
      return (
        <>
          <p className="routine-note">
            <T {...until(status.expiresAt)} />
          </p>
          <RoutineShared />
          <SignOut email={status.email} />
        </>
      );
    case "owner":
      return (
        <RoutineOrganizer
          access={<OwnerPanel pending={status.pending} active={status.active} onChange={load} />}
        />
      );
  }
}
