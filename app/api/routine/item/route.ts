import type { NextRequest } from "next/server";
import { accessError, accessErrorStatus } from "@/lib/routine-access";
import { parseAction, type ItemKind } from "@/lib/routine-model";
import { fromOwnSite, reply, routineClient } from "@/lib/routine-server";

export const dynamic = "force-dynamic";

const TABLES: Record<ItemKind, string> = {
  block: "routine_blocks",
  task: "routine_tasks",
  habit: "routine_habits",
};

/**
 * Every change the owner makes. The database refuses everyone else: row level
 * security hides the rows from them, so an update here matches nothing, which
 * is why each one checks that a row came back.
 */
export async function POST(request: NextRequest) {
  if (!fromOwnSite(request)) return reply({ error: "forbidden" }, 403);

  const supabase = await routineClient();
  if (!supabase) return reply({ error: "unknown" }, 503);

  const action = parseAction(await request.json().catch(() => null));
  if (!action) return reply({ error: "invalid_request" }, 400);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return reply({ error: "not_signed_in" }, 401);

  const refuse =(message: string | undefined) => {
    const code = accessError(message);
    return reply({ error: code }, accessErrorStatus(code));
  };

  switch (action.action) {
    case "save": {
      const table = supabase.from(TABLES[action.kind]);
      const values = action.values as Record<string, unknown>;
      const { data, error } = action.id
        ? await table.update(values).eq("id", action.id).select("id")
        : await table.insert(values).select("id");
      if (error) return refuse(error.message);
      return data?.length ? reply({ ok: true }) : reply({ error: "not_owner" }, 403);
    }
    case "archive": {
      const { data, error } = await supabase
        .from(TABLES[action.kind])
        .update({ archived_at: new Date().toISOString() })
        .eq("id", action.id)
        .select("id");
      if (error) return refuse(error.message);
      return data?.length ? reply({ ok: true }) : reply({ error: "not_owner" }, 403);
    }
    case "done": {
      const { data, error } = await supabase
        .from("routine_tasks")
        .update({ done_at: action.done ? new Date().toISOString() : null })
        .eq("id", action.id)
        .select("id");
      if (error) return refuse(error.message);
      return data?.length ? reply({ ok: true }) : reply({ error: "not_owner" }, 403);
    }
    case "reschedule": {
      const { data, error } = await supabase
        .from("routine_tasks")
        .update({ due_on: action.due_on, due_min: null })
        .in("id", action.ids)
        .select("id");
      if (error) return refuse(error.message);
      return data?.length ? reply({ ok: true }) : reply({ error: "not_owner" }, 403);
    }
    case "check": {
      const { habit_id, on_date, checked } = action;
      const { error } = checked
        ? await supabase
            .from("routine_habit_checks")
            .upsert({ habit_id, on_date }, { ignoreDuplicates: true })
        : await supabase
            .from("routine_habit_checks")
            .delete()
            .eq("habit_id", habit_id)
            .eq("on_date", on_date);
      return error ? refuse(error.message) : reply({ ok: true });
    }
    case "log": {
      const { error } = await supabase
        .from("routine_logs")
        .upsert({ on_date: action.on_date, body: action.body });
      return error ? refuse(error.message) : reply({ ok: true });
    }
    case "undo": {
      const { error } = await supabase.rpc("routine_undo", { p_change: action.change });
      return error ? refuse(error.message) : reply({ ok: true });
    }
    case "undo_note": {
      const { error } = await supabase.rpc("routine_undo_batch", { p_batch: action.batch });
      return error ? refuse(error.message) : reply({ ok: true });
    }
  }
}
