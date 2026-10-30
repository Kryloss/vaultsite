import { NextResponse, type NextRequest } from "next/server";
import { fromOwnSite, reply, routineClient, siteOrigin } from "@/lib/routine-server";

export const dynamic = "force-dynamic";

/** Both buttons on /routine post here: Google decides who this is, the database what they get. */
export async function POST(request: NextRequest) {
  if (!fromOwnSite(request)) return reply({ error: "forbidden" }, 403);

  const origin = siteOrigin(request);
  const failed = NextResponse.redirect(new URL("/routine?signin=failed", origin), 303);

  const supabase = await routineClient();
  if (!supabase) return failed;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/api/routine/auth/callback`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) return failed;

  return NextResponse.redirect(data.url, 303);
}
