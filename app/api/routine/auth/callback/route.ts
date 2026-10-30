import { NextResponse, type NextRequest } from "next/server";
import { routineClient, siteOrigin } from "@/lib/routine-server";

export const dynamic = "force-dynamic";

/** Google returns here. The destination is fixed, so this can't be used as an open redirect. */
export async function GET(request: NextRequest) {
  const origin = siteOrigin(request);
  const code = request.nextUrl.searchParams.get("code");
  const supabase = await routineClient();

  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/routine", origin), 303);
  }
  return NextResponse.redirect(new URL("/routine?signin=failed", origin), 303);
}
