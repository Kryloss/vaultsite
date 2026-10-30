import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accessError,
  accessErrorStatus,
  cleanText,
  isUuid,
  parseAccessRequest,
  requestEmail,
} from "./routine-access.ts";
import { dayCount } from "./plural.ts";

const valid = { relationship: "Classmate", reason: "Planning group study", days: 7 };

test("a well-formed request passes and is trimmed", () => {
  assert.deepEqual(parseAccessRequest({ ...valid, reason: "  Planning  " }), {
    ...valid,
    reason: "Planning",
  });
});

test("a request can only ask for the offered lengths", () => {
  for (const days of [0, 2, 31, 365, "7", null, undefined, 7.5]) {
    assert.equal(parseAccessRequest({ ...valid, days }), null, String(days));
  }
});

test("blank and oversized fields are refused", () => {
  assert.equal(parseAccessRequest({ ...valid, relationship: "   " }), null);
  assert.equal(parseAccessRequest({ ...valid, reason: "" }), null);
  assert.equal(parseAccessRequest({ ...valid, relationship: "x".repeat(201) }), null);
  assert.equal(parseAccessRequest({ ...valid, reason: "x".repeat(1001) }), null);
  assert.equal(parseAccessRequest({ ...valid, reason: 5 }), null);
});

test("a body that isn't an object is refused", () => {
  for (const body of [null, "text", 7, undefined]) {
    assert.equal(parseAccessRequest(body), null);
  }
});

test("control characters can't start a new line in the email", () => {
  assert.equal(cleanText("one\r\nBcc: x@example.com\u0007"), "one Bcc: x@example.com");
  const { subject, text } = requestEmail(
    { ...valid, email: "a@example.com", displayName: "Name\r\nBcc: x@example.com" },
    "https://kryloss.com/routine"
  );
  assert.equal(subject.includes("\n"), false);
  assert.equal(text.split("\n").some((line) => line.startsWith("Bcc:")), false);
});

test("the email carries what the owner decides from, and only a link to the page", () => {
  const { subject, text } = requestEmail(
    { ...valid, email: "a@example.com", displayName: "Ada" },
    "https://kryloss.com/routine"
  );
  assert.match(subject, /Ada/);
  for (const part of ["a@example.com", "Classmate", "Planning group study", "7 days"]) {
    assert.ok(text.includes(part), part);
  }
  assert.equal(text.match(/https?:\/\//g)?.length, 1);
  assert.ok(text.endsWith("https://kryloss.com/routine"));
});

test("a Google account with no name falls back to its address", () => {
  const { subject } = requestEmail(
    { ...valid, days: 1, email: "a@example.com", displayName: "" },
    "https://kryloss.com/routine"
  );
  assert.match(subject, /a@example\.com/);
});

test("an unknown database error never reaches the page as text", () => {
  assert.equal(accessError("cooldown"), "cooldown");
  assert.equal(accessError('relation "secret" does not exist'), "unknown");
  assert.equal(accessError(undefined), "unknown");
});

test("refusals map to their HTTP status", () => {
  assert.equal(accessErrorStatus("not_signed_in"), 401);
  assert.equal(accessErrorStatus("not_owner"), 403);
  assert.equal(accessErrorStatus("invalid_request"), 400);
  assert.equal(accessErrorStatus("daily_limit"), 429);
  assert.equal(accessErrorStatus("already_pending"), 409);
  assert.equal(accessErrorStatus("unknown"), 500);
});

test("isUuid accepts ids and nothing shaped like an injection", () => {
  assert.equal(isUuid("431a16d9-778b-40e8-9d2f-4cf73d2668a2"), true);
  assert.equal(isUuid("431a16d9-778b-40e8-9d2f-4cf73d2668a2' or 1=1"), false);
  assert.equal(isUuid(7), false);
});

test("dayCount declines in both languages", () => {
  assert.deepEqual(dayCount(1), { en: "1 day", uk: "1 день" });
  assert.deepEqual(dayCount(7), { en: "7 days", uk: "7 днів" });
  assert.deepEqual(dayCount(22), { en: "22 days", uk: "22 дні" });
});
