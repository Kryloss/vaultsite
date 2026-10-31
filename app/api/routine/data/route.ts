import type { NextRequest } from "next/server";
import { addDays, isDate, type Change } from "@/lib/routine-model";
import { reply, routineClient } from "@/lib/routine-server";

export const dynamic = "force-dynamic";

const BLOCK_FIELDS =
  "id,title,weekday,on_date,start_min,end_min,location,notes,shareable,source";
const TASK_FIELDS = "id,title,notes,due_on,due_min,done_at,shareable,source";
const HABIT_FIELDS = "id,title,weekdays,source";

/**
 * What this visitor may read for the week starting at `from`. The owner gets the
 * rows; a viewer gets `routine_shared_days()` and nothing else; anyone else gets
 * a refusal, which the tables would give them anyway.
 */
export async function GET(request: NextRequest) {
  const supabase = await routineClient();
  if (!supabase) return reply({ error: "unknown" }, 503);

  const from = request.nextUrl.searchParams.get("from");
  if (!isDate(from)) return reply({ error: "invalid_request" }, 400);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return reply({ error: "not_signed_in" }, 401);

  const { data: status, error: statusError } = await supabase.rpc("routine_status");
  if (statusError) return reply({ error: "unknown" }, 503);

  if (status.role === "viewer") {
    const { data: days, error } = await supabase.rpc("routine_shared_days", { p_from: from });
    if (error) return reply({ error: "not_owner" }, 403);
    return reply({ days });
  }

  if (status.role !== "owner") return reply({ error: "not_owner" }, 403);

  const first = addDays(from, -7);
  const last = addDays(from, 13);
  const [blocks, tasks, habits, checks, logs, changes, synced, review] = await Promise.all([
    supabase.from("routine_blocks").select(BLOCK_FIELDS).is("archived_at", null),
    supabase
      .from("routine_tasks")
      .select(TASK_FIELDS)
      .is("archived_at", null)
      .or(`done_at.is.null,due_on.gte.${first}`),
    supabase.from("routine_habits").select(HABIT_FIELDS).is("archived_at", null).order("created_at"),
    supabase
      .from("routine_habit_checks")
      .select("habit_id,on_date")
      .gte("on_date", first)
      .lte("on_date", last),
    supabase.from("routine_logs").select("on_date,body").gte("on_date", first).lte("on_date", last),
    supabase
      .from("routine_changes")
      .select("id,at,actor,item_kind,op,after")
      .is("undone_at", null)
      .order("id", { ascending: false })
      .limit(20),
    supabase.rpc("routine_sync_status"),
    supabase.from("routine_reviews").select("body").eq("week", from).maybeSingle(),
  ]);

  const failed = [blocks, tasks, habits, checks, logs, changes].some((result) => result.error);
  if (failed) return reply({ error: "unknown" }, 500);

  return reply({
    blocks: blocks.data,
    tasks: tasks.data,
    habits: habits.data,
    checks: checks.data,
    logs: logs.data,
    syncedAt: synced.data ?? null,
    review: review.data?.body ?? null,
    changes: (changes.data ?? []).map(
      ({ after, ...change }): Change => ({
        ...(change as Omit<Change, "title">),
        title: (after as { title?: string })?.title ?? "",
      })
    ),
  });
}
