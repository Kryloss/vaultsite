import type { RoutineStatus } from "@/lib/routine-access";
import { reply, routineClient } from "@/lib/routine-server";

export const dynamic = "force-dynamic";

/** Who this visitor is to /routine. The page is static; this is all it knows. */
export async function GET() {
  const unavailable: RoutineStatus = { role: "unavailable" };

  const supabase = await routineClient();
  if (!supabase) return reply(unavailable, 503);

  // getUser() asks the auth server rather than trusting the cookie, and renews
  // a session that has run out.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return reply({ role: "signedOut" } satisfies RoutineStatus);

  const { data: status, error } = await supabase.rpc("routine_status");
  if (error) return reply(unavailable, 503);

  if (status.role !== "owner") return reply(status);

  const { data: overview, error: overviewError } = await supabase.rpc("routine_access_overview");
  if (overviewError) return reply(unavailable, 503);
  return reply({ role: "owner", ...overview });
}
