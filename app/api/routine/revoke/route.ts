import type { NextRequest } from "next/server";
import { accessError, accessErrorStatus, isUuid } from "@/lib/routine-access";
import { fromOwnSite, reply, routineClient } from "@/lib/routine-server";

export const dynamic = "force-dynamic";

/** End a viewer's access now. The database refuses anyone but the owner. */
export async function POST(request: NextRequest) {
  if (!fromOwnSite(request)) return reply({ error: "forbidden" }, 403);

  const supabase = await routineClient();
  if (!supabase) return reply({ error: "unknown" }, 503);

  const body = await request.json().catch(() => null);
  if (!isUuid(body?.id)) return reply({ error: "invalid_request" }, 400);

  const { error } = await supabase.rpc("revoke_access", { p_grant: body.id });
  if (error) {
    const code = accessError(error.message);
    return reply({ error: code }, accessErrorStatus(code));
  }
  return reply({ ok: true });
}
