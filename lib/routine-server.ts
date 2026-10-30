import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { RequestDetails } from "@/lib/routine-access";
import { requestEmail } from "@/lib/routine-access";
import { siteUrl } from "@/lib/site-config";

/**
 * The server half of /routine, imported only by `app/api/routine/`.
 *
 * Every Supabase call here runs as the visitor, with the publishable key and
 * their own session. There is deliberately no service-role key anywhere in the
 * site: Postgres decides what a visitor may do, so a mistake in a route handler
 * can't hand them more than the database would (DECISIONS #235).
 *
 * The settings exist only on Vercel's Production environment. Anywhere else
 * `routineClient()` returns null and the page says it is unavailable, which
 * keeps preview deployments of a public repository out of it.
 */

/** Session cookies go only to these routes; the rest of the site never carries them. */
const COOKIE_PATH = "/api/routine";

const production = process.env.NODE_ENV === "production";

/** Where this site lives. In production that never comes from a request header. */
export function siteOrigin(request: NextRequest): string {
  return production ? siteUrl : request.nextUrl.origin;
}

/** Whether a state-changing request came from the site's own page. */
export function fromOwnSite(request: NextRequest): boolean {
  return request.headers.get("origin") === siteOrigin(request);
}

/** JSON that no browser or CDN may keep. */
export function reply(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function routineClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(list) {
        for (const { name, value, options } of list) {
          // httpOnly: nothing in the browser reads the session, so no script
          // running on the page can read it either.
          store.set(name, value, {
            ...options,
            path: COOKIE_PATH,
            httpOnly: true,
            secure: production,
            sameSite: "lax",
          });
        }
      },
    },
  });
}

/**
 * Tell the owner about a request. Sent after the row exists, so a failure here
 * costs an email and not the request: it still waits on the page.
 */
export async function sendRequestEmail(details: RequestDetails): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ROUTINE_FROM_EMAIL;
  const to = process.env.ROUTINE_NOTIFY_EMAIL;
  if (!apiKey || !from || !to) return false;

  const { subject, text } = requestEmail(details, `${siteUrl}/routine`);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, reply_to: details.email, subject, text }),
      signal: AbortSignal.timeout(8000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
