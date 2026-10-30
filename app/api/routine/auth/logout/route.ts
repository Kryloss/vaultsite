import { NextResponse, type NextRequest } from "next/server";
import { fromOwnSite, reply, routineClient, siteOrigin } from "@/lib/routine-server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!fromOwnSite(request)) return reply({ error: "forbidden" }, 403);

  const supabase = await routineClient();
  await supabase?.auth.signOut({ scope: "local" });
  return NextResponse.redirect(new URL("/routine", siteOrigin(request)), 303);
}
