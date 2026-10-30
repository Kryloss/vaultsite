import type { NextRequest } from "next/server";
import {
  buildContext,
  MAX_NOTE,
  parseAnswer,
  systemPrompt,
  userPrompt,
} from "@/lib/routine-gemini";
import { fromOwnSite, reply, routineClient } from "@/lib/routine-server";
import { addDays, type Block, type DayLog, type Habit, type Task } from "@/lib/routine-model";
import { askGemini, geminiConnected } from "@/lib/routine-vertex";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * One messy note, organized. The order matters: the daily limit is taken before
 * the call so a loop can't outrun it, and nothing is written until the whole
 * answer has passed `parseAnswer`. `routine_apply_gemini` then applies it as one
 * transaction, so a failure anywhere leaves the routine as it was.
 */
export async function POST(request: NextRequest) {
  if (!fromOwnSite(request)) return reply({ error: "forbidden" }, 403);

  const supabase = await routineClient();
  if (!supabase) return reply({ error: "unknown" }, 503);
  if (!geminiConnected()) return reply({ error: "gemini_off" }, 503);

  const body = await request.json().catch(() => null);
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  if (!note || note.length > MAX_NOTE) return reply({ error: "invalid_request" }, 400);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return reply({ error: "not_signed_in" }, 401);

  const { error: reserveError } = await supabase.rpc("routine_ai_reserve");
  if (reserveError) {
    const limited = reserveError.message === "daily_limit";
    return reply({ error: limited ? "daily_limit" : "not_owner" }, limited ? 429 : 403);
  }

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const [blocks, tasks, habits, logs] = await Promise.all([
    supabase
      .from("routine_blocks")
      .select("id,title,weekday,on_date,start_min,end_min,location,notes,shareable,source")
      .is("archived_at", null),
    supabase
      .from("routine_tasks")
      .select("id,title,notes,due_on,due_min,done_at,shareable,source")
      .is("archived_at", null)
      .is("done_at", null),
    supabase.from("routine_habits").select("id,title,weekdays,source").is("archived_at", null),
    supabase.from("routine_logs").select("on_date,body").gte("on_date", addDays(today, -7)),
  ]);
  if (blocks.error || tasks.error || habits.error || logs.error) {
    return reply({ error: "unknown" }, 500);
  }

  const { text, refs } = buildContext(
    {
      blocks: blocks.data as Block[],
      tasks: tasks.data as Task[],
      habits: habits.data as Habit[],
      logs: logs.data as DayLog[],
    },
    today
  );

  let result: Awaited<ReturnType<typeof askGemini>>;
  try {
    result = await askGemini(systemPrompt(today), userPrompt(text, note));
  } catch (error) {
    console.error("routine: Gemini call failed:", (error as Error).message);
    return reply({ error: "gemini_failed" }, 502);
  }

  await supabase.rpc("routine_ai_record", {
    p_input: result.inputTokens,
    p_output: result.outputTokens,
  });

  const parsed = parseAnswer(result.answer, refs, (reason) =>
    console.error("routine: answer refused:", reason)
  );
  if (!parsed) return reply({ error: "gemini_bad" }, 422);
  if (!parsed.ops.length) return reply({ message: parsed.message, batch: null });

  const { data: batch, error } = await supabase.rpc("routine_apply_gemini", { p_ops: parsed.ops });
  if (error) {
    console.error("routine: apply refused:", error.code, error.message);
    return reply({ error: "gemini_bad" }, 422);
  }

  return reply({ message: parsed.message, batch });
}
