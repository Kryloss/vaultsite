# Routine

`/routine` is the owner's private daily organizer. Built so far: the access layer (sign-in, requests, approval, expiry, the viewer gate), the organizer itself (Today and Week views, tasks, habits, the daily log, undo), and Gemini organizing a typed note. The Uni sync comes later. Why it is built this way: `docs/DECISIONS.md` #235, #236 and #237.

## Gemini

The owner types a note on Today, and Gemini applies it straight away. It can add, change, finish and remove items, in English whatever language the note was in. **Undo** beside its reply takes the whole note back.

- **It has no tools.** `/api/routine/organize` sends a note and returns JSON. `parseAnswer()` in `lib/routine-gemini.ts` checks every change, and one bad change refuses the whole note. `routine_apply_gemini()` then applies it as one transaction.
- **It can only name what it was shown.** Items reach it as `b1`, `t2`, `h3`, never as database ids.
- **It can't change what viewers see.** `shareable` is not sent, not in the answer's schema, and not in the database function. Anything Gemini adds starts private.
- **What it reads:** titles, times, locations, notes and the last 7 days of daily logs, with long fields cut. Requests, viewers and email addresses never reach it.
- **Limits:** 40 calls a day in `routine_ai_reserve()`, counted before the call. Each note is capped at 30 changes and 5 removals. Google's spend cap sits above that.
- **Costs:** model `gemini-3.1-flash-lite` on Vertex with thinking at `LOW`, overridable with `ROUTINE_GEMINI_MODEL`. Check a new model accepts that level first: `MINIMAL` dropped details from real notes, and Gemini 3.8 Flash reportedly refuses it. Output stops at 8192 tokens, which has to cover thinking as well as the answer: a real note was cut off at 2048.
- **No key exists.** Vercel proves which deployment is asking and Google issues a short-lived token. Only the Production environment is trusted.

## The organizer

- **`lib/routine-model.ts` holds the rules:** what a day contains, and what a save may contain. Dates are `YYYY-MM-DD` strings and times are minutes since midnight, so neither passes through a time zone. Weekdays are ISO: 1 is Monday.
- **A task with no date waits on today** so it can't get lost. Past-due tasks collapse into one card on today with **Move all to today**, so they don't pile up. The owner's own weekly notes showed why: 11 overdue reminders that nobody cleared.
- **Nothing is deleted.** Remove sets `archived_at`, the app has no DELETE privilege on blocks, tasks or habits, and `routine_changes` records every insert and update through a trigger, whoever made it. **Undo** works on any recent change. Habit ticks and the daily log are not in the history: a tick is undone by unticking, and the log is one text box.
- **Later phases write through the same tables.** They set `routine.actor` so the history names them, and `source` plus `source_key` so a sync can find what it already added.
- **New items are private.** `shareable` is off unless the owner ticks it, and a value that isn't exactly `true` stays off.

## How it fits a static site

- **`app/routine/page.tsx` is a static page with no private data in it.** Never make it dynamic: the root layout reads `vault/` from disk, so a dynamic route would read the vault at runtime (hard rule 2).
- **`app/api/routine/*` are the only runtime code on the site.** There is no middleware, so no other page runs anything per request.
- `components/RoutineAccess.tsx` asks `/api/routine/status` after hydration and draws what that says. It draws nothing until the answer arrives.
- The tab is pushed onto the sidebar's items in `app/layout.tsx`, since no vault folder backs it. It stays out of the sitemap and search index, carries `noindex`, and `robots.txt` disallows `/api/`.

## Where the rules live

Postgres, in `supabase/migrations/`. Signed-in users hold no privilege on the access tables, only EXECUTE on eleven functions: `routine_status`, `submit_access_request`, `routine_access_overview`, `decide_access_request`, `revoke_access`, `routine_undo`, `routine_undo_batch`, `routine_shared_days`, `routine_apply_gemini`, `routine_ai_reserve`, `routine_ai_record`. Each one checks who is calling. Anonymous callers can execute none of them.

The organizer tables (`routine_*`) grant `authenticated` the privileges the app needs, behind a row level security policy that only the owner passes. For anyone else they read as empty and refuse writes.

**A viewer's only way in is `routine_shared_days()`.** It returns seven days of block times, with titles only for shareable blocks, plus the titles of shareable tasks. It reads no location, note, habit or log, and clamps its dates so a viewer can't read history. An unshared block still shows that the owner is busy at that time; that is the agreed trade.

The site has **no service-role key**. Route handlers run as the visitor with the publishable key, so a mistake in one can't grant more than the database would.

Keep these true:

- **Identity comes from `auth.identities`, never `user_metadata`.** A signed-in user can rewrite their own metadata with one API call.
- **The owner is `private.owner`,** a single row holding a user id and Google's permanent account id. It is written by hand once (below). With no row, nobody is the owner.
- **Expiry is read on every request.** Nothing has to run for access to end.
- **Requests need a verified Google identity.** Limits: one pending per account, 7 days between a denial and the next request, 5 requests a day across the site.
- **The email has no approve link that acts on its own.** A mail scanner can fire a link. It opens `/routine`, where the owner must be signed in.
- **The email carries the name and address the database read from Google,** never anything from the request body.
- **State-changing routes check `Origin`,** and the session cookies are httpOnly and scoped to `/api/routine`.
- **Never put an email address in the repository.** It is public, and `scripts/routine.test.mjs` checks.

## Settings

Set on Vercel's **Production** environment only. Anywhere else the routes return unavailable, which keeps preview deployments out.

| Variable | What it is |
|---|---|
| `SUPABASE_URL` | The Routine project's API URL |
| `SUPABASE_PUBLISHABLE_KEY` | Its publishable key |
| `RESEND_API_KEY` | Sends the request email |
| `ROUTINE_FROM_EMAIL` | A sender on a domain verified in Resend |
| `ROUTINE_NOTIFY_EMAIL` | Where requests go |
| `GCP_PROJECT_ID` | The Google Cloud project's ID |
| `GCP_PROJECT_NUMBER` | Its number |
| `GCP_SERVICE_ACCOUNT_EMAIL` | The service account Vercel acts as, holding only Vertex AI User |
| `GCP_WORKLOAD_IDENTITY_POOL_ID` | The identity pool, `vercel` |
| `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID` | Its provider, `vercel` |

Google Cloud needs: the Vertex AI API on; a workload identity pool whose OIDC provider has the issuer `https://oidc.vercel.com/kryloss-projects`, allowed audience `https://vercel.com/kryloss-projects` and `google.subject` mapped to `assertion.sub`; Workload Identity User on the service account for only the subject `owner:kryloss-projects:project:vaultsite:environment:production`; project-wide caching disabled; and a spend cap on Vertex. Without these the note box says Gemini isn't connected.

Supabase Authentication: Google on, Email and Phone off, Site URL `https://kryloss.com`, redirect URL `https://kryloss.com/api/routine/auth/callback`.

Google OAuth client: authorized redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`. The consent screen must be **In production**: in Testing mode only listed accounts can sign in. Branding: home page `https://kryloss.com/routine`, privacy policy `https://kryloss.com/routine/privacy`, authorized domains `kryloss.com` and the Supabase project's. No logo: adding one requires Google's verification. Only basic profile scopes are requested.

`/routine/privacy` describes what is stored (`routinePrivacy` in `lib/ui-strings.ts`), and `/routine` must keep linking to it, which Google requires. If the page starts storing anything new, or a viewer's data starts reaching Gemini, change that text in the same commit.

## Locking the owner

Run once in the Supabase SQL editor, after the owner's first sign-in, with the real address:

```sql
insert into private.owner (user_id, google_sub)
select user_id, provider_id
from auth.identities
where provider = 'google'
  and lower(identity_data ->> 'email') = lower('owner-address-here')
  and (identity_data ->> 'email_verified')::boolean;
```

Changing the owner takes SQL on purpose. Nothing in the site can do it.

## Checking changes

Schema changes go in a new migration file, and get tested as fake users in a transaction that rolls back: set `request.jwt.claims` and `set local role authenticated`, then try what each kind of user must not be able to do. Run the Supabase security advisor after. Two findings are expected: `rls_enabled_no_policy` on the access tables, and `authenticated_security_definer_function_executable` on the eleven functions above. `auth_leaked_password_protection` also appears and doesn't apply, since password sign-in is off.

`/routine` has a limit no test covers: the Google redirect only works on the real domain.
