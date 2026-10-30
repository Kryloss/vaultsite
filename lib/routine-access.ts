/**
 * /routine access: the shapes and pure rules shared by the page and its API
 * routes. The rules that protect anything are in Postgres
 * (supabase/migrations/); what is here decides what a request looks like before
 * it gets there, and what the owner's email says.
 *
 * No server-only imports: `components/RoutineAccess.tsx` is a client component.
 */

/** How long a visitor can ask for, and how long the owner can give. */
export const DAY_CHOICES = [1, 7, 30] as const;
export const DEFAULT_DAYS = 7;

/** The same limits as the CHECK constraints on `access_requests`. */
export const MAX_RELATIONSHIP = 200;
export const MAX_REASON = 1000;

export interface PendingRequest {
  id: string;
  email: string;
  displayName: string;
  relationship: string;
  reason: string;
  days: number;
  createdAt: string;
}

export interface ActiveViewer {
  id: string;
  email: string;
  displayName: string;
  expiresAt: string;
}

export type RoutineStatus =
  | { role: "unavailable" }
  | { role: "signedOut" }
  | { role: "unverified" }
  | { role: "none" | "pending" | "denied"; email: string }
  | { role: "viewer"; email: string; expiresAt: string }
  | { role: "owner"; pending: PendingRequest[]; active: ActiveViewer[] };

export interface AccessRequest {
  relationship: string;
  reason: string;
  days: number;
}

/** The fields of the email the owner decides from, as the database returned them. */
export interface RequestDetails extends AccessRequest {
  email: string;
  displayName: string;
}

const ACCESS_ERRORS = [
  "already_approved",
  "already_owner",
  "already_pending",
  "cooldown",
  "daily_limit",
  "google_required",
  "invalid_request",
  "not_active",
  "not_owner",
  "not_pending",
  "not_signed_in",
] as const;

export type AccessError = (typeof ACCESS_ERRORS)[number] | "unknown";

/** A Postgres `raise exception` message → one of the codes the page knows. */
export function accessError(message: string | undefined): AccessError {
  return ACCESS_ERRORS.find((code) => code === message) ?? "unknown";
}

/** The HTTP status for a refused request. */
export function accessErrorStatus(code: AccessError): number {
  if (code === "not_signed_in") return 401;
  if (code === "not_owner" || code === "google_required") return 403;
  if (code === "invalid_request") return 400;
  if (code === "daily_limit" || code === "cooldown") return 429;
  if (code === "unknown") return 500;
  return 409;
}

/** One line of plain text: control characters go, which is what keeps a header out of the body. */
export function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
}

/** The request form's body, or null when it can't be what the form sends. */
export function parseAccessRequest(body: unknown): AccessRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const { relationship, reason, days } = body as Record<string, unknown>;
  const cleanRelationship = cleanText(relationship);
  const cleanReason = cleanText(reason);
  if (cleanRelationship.length < 1 || cleanRelationship.length > MAX_RELATIONSHIP) return null;
  if (cleanReason.length < 1 || cleanReason.length > MAX_REASON) return null;
  if (!DAY_CHOICES.includes(days as (typeof DAY_CHOICES)[number])) return null;
  return { relationship: cleanRelationship, reason: cleanReason, days: days as number };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/**
 * The email to the owner. Plain text with no approve link in it: a link that
 * acts on its own can be fired by a mail scanner or a forward, so it only opens
 * the page, where the owner has to be signed in.
 */
export function requestEmail(
  details: RequestDetails,
  pageUrl: string
): { subject: string; text: string } {
  const who = cleanText(details.displayName) || cleanText(details.email);
  return {
    subject: `Routine access request from ${who.slice(0, 80)}`,
    text: [
      `${who} is asking to view your routine.`,
      "",
      `Name: ${cleanText(details.displayName) || "(not given by Google)"}`,
      `Verified Google email: ${cleanText(details.email)}`,
      `How they know you: ${details.relationship}`,
      `Why they want access: ${details.reason}`,
      `Access requested: ${details.days} ${details.days === 1 ? "day" : "days"}`,
      "",
      `Approve or deny: ${pageUrl}`,
    ].join("\n"),
  };
}
