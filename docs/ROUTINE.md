# Routine

`/routine` is the owner's private daily organizer. Phase 1 is the access layer only: sign-in, requests, approval, expiry and the viewer gate. The organizer itself, Gemini and the Uni sync come later. Why it is built this way: `docs/DECISIONS.md` #235.

## How it fits a static site

- **`app/routine/page.tsx` is a static page with no private data in it.** Never make it dynamic: the root layout reads `vault/` from disk, so a dynamic route would read the vault at runtime (hard rule 2).
- **`app/api/routine/*` are the only runtime code on the site.** There is no middleware, so no other page runs anything per request.
- `components/RoutineAccess.tsx` asks `/api/routine/status` after hydration and draws what that says. It draws nothing until the answer arrives.
- The tab is pushed onto the sidebar's items in `app/layout.tsx`, since no vault folder backs it. It stays out of the sitemap and search index, carries `noindex`, and `robots.txt` disallows `/api/`.

## Where the rules live

Postgres, in `supabase/migrations/`. Signed-in users hold no privilege on any table, only EXECUTE on five functions: `routine_status`, `submit_access_request`, `routine_access_overview`, `decide_access_request`, `revoke_access`. Each one checks who is calling. Anonymous callers can execute none of them.

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

Schema changes go in a new migration file, and get tested as fake users in a transaction that rolls back: set `request.jwt.claims` and `set local role authenticated`, then try what each kind of user must not be able to do. Run the Supabase security advisor after. Two findings are expected: `rls_enabled_no_policy` on the access tables, and `authenticated_security_definer_function_executable` on the five functions above.

`/routine` has a limit no test covers: the Google redirect only works on the real domain.
