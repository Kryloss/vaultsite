import type { NextRequest } from "next/server";
import {
  accessError,
  accessErrorStatus,
  parseAccessRequest,
  type RequestDetails,
} from "@/lib/routine-access";
import { fromOwnSite, reply, routineClient, sendRequestEmail } from "@/lib/routine-server";

export const dynamic = "force-dynamic";

/** Ask for access. The database sets the name and email from Google, never from this body. */
export async function POST(request: NextRequest) {
  if (!fromOwnSite(request)) return reply({ error: "forbidden" }, 403);

  const supabase = await routineClient();
  if (!supabase) return reply({ error: "unknown" }, 503);

  const fields = parseAccessRequest(await request.json().catch(() => null));
  if (!fields) return reply({ error: "invalid_request" }, 400);

  const { data, error } = await supabase.rpc("submit_access_request", {
    p_relationship: fields.relationship,
    p_reason: fields.reason,
    p_days: fields.days,
  });
  if (error) {
    const code = accessError(error.message);
    return reply({ error: code }, accessErrorStatus(code));
  }

  const notified = await sendRequestEmail(data as RequestDetails);
  return reply({ ok: true, notified });
}
