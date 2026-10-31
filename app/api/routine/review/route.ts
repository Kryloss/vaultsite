import type { NextRequest } from "next/server";
import { addDays, isDate, weekStart, type DayLog, type Habit, type HabitCheck } from "@/lib/routine-model";
import {
  parseReview,
  REVIEW_SCHEMA,
  reviewContext,
  reviewSystemPrompt,
  reviewUserPrompt,
  type ReviewTask,
} from "@/lib/routine-review";
import { fromOwnSite, reply, routineClient } from "@/lib/routine-server";
import { askGemini, geminiConnected } from "@/lib/routine-vertex";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * One week, reviewed. It shares the daily Gemini limit with notes, and the result
 * is stored so opening it later costs nothing. It writes only `routine_reviews`.
 */
export async function POST(request: NextRequest) {
  if (!fromOwnSite(request)) return reply({ error: "forbidden" }, 403);

  const supabase = await routineClient();
  if (!supabase) return reply({ error: "unknown" }, 503);
  if (!geminiConnected()) return reply({ error: "gemini_off" }, 503);

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const body = await request.json().catch(() => null);
  const week = body?.week;
  if (!isDate(week) || weekStart(week) !== week || week > weekStart(today)) {
    return reply({ error: "invalid_request" }, 400);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return reply({ error: "not_signed_in" }, 401);

  const { error: reserveError } = await supabase.rpc("routine_ai_reserve");
  if (reserveError) {
    const limited = reserveError.message === "daily_limit";
    return reply({ error: limited ? "daily_limit" : "not_owner" }, limited ? 429 : 403);
  }

  const lastDay = addDays(week, 6);
  const [tasks, habits, checks, logs] = await Promise.all([
    supabase
      .from("routine_tasks")
      .select("title,due_on,done_at")
      .is("archived_at", null)
      .gte("due_on", week)
      .lte("due_on", addDays(week, 13)),
    supabase.from("routine_habits").select("id,title,weekdays,source").is("archived_at", null),
    supabase.from("routine_habit_checks").select("habit_id,on_date").gte("on_date", week).lte("on_date", lastDay),
    supabase.from("routine_logs").select("on_date,body").gte("on_date", week).lte("on_date", lastDay),
  ]);
  if (tasks.error || habits.error || checks.error || logs.error) {
    return reply({ error: "unknown" }, 500);
  }

  const context = reviewContext(
    {
      tasks: tasks.data as ReviewTask[],
      habits: habits.data as Habit[],
      checks: checks.data as HabitCheck[],
      logs: logs.data as DayLog[],
    },
    week
  );

  let result: Awaited<ReturnType<typeof askGemini>>;
  try {
    result = await askGemini(reviewSystemPrompt(week), reviewUserPrompt(context), REVIEW_SCHEMA);
  } catch (error) {
    console.error("routine: Gemini call failed:", (error as Error).message);
    return reply({ error: "gemini_failed" }, 502);
  }

  await supabase.rpc("routine_ai_record", {
    p_input: result.inputTokens,
    p_output: result.outputTokens,
  });

  const review = parseReview(result.answer);
  if (!review) return reply({ error: "gemini_bad" }, 422);

  const { error } = await supabase.from("routine_reviews").upsert({ week, body: review });
  if (error) return reply({ error: "unknown" }, 500);

  return reply({ review });
}
