import { NextResponse, type NextRequest } from "next/server";
import { localDate, parseAction } from "@/lib/routine-model";
import {
  applyAction,
  dataFor,
  emptyState,
  fullState,
  organizeNote,
  reviewWeek,
  scenarioFrom,
  sharedDays,
  statusFor,
  type SampleState,
  type Scenario,
} from "@/lib/routine-sample";
import { reply } from "@/lib/routine-server";

export const dynamic = "force-dynamic";

/**
 * Stands in for `/api/routine/*` while `ROUTINE_SAMPLE` is set, through a rewrite
 * in `next.config.ts` that exists only in development (docs/ROUTINE.md). It holds
 * invented data in memory and answers nothing in production.
 */

type Context = { params: Promise<{ path: string[] }> };

const stores = globalThis as typeof globalThis & { routineSample?: Record<string, SampleState> };

function stateFor(scenario: Scenario): SampleState {
  stores.routineSample ??= {};
  const name = scenario === "empty" ? "empty" : "full";
  stores.routineSample[name] ??= name === "empty" ? emptyState() : fullState(localDate(new Date()));
  return stores.routineSample[name];
}

/** `/routine?sample=viewer` picks a state without restarting the server. */
function scenarioOf(request: NextRequest): Scenario {
  const referer = request.headers.get("referer");
  const chosen = referer ? new URL(referer).searchParams.get("sample") : null;
  return scenarioFrom(chosen ?? process.env.ROUTINE_SAMPLE);
}

const available = () => process.env.NODE_ENV === "development" && Boolean(process.env.ROUTINE_SAMPLE);

const thinking = () => new Promise((resolve) => setTimeout(resolve, 900));

export async function GET(request: NextRequest, { params }: Context) {
  if (!available()) return new NextResponse(null, { status: 404 });

  const [route] = (await params).path;
  const scenario = scenarioOf(request);
  const state = stateFor(scenario);

  if (route === "status") {
    return reply({ ...statusFor(state, scenario), sample: true });
  }

  if (route === "data") {
    const from = request.nextUrl.searchParams.get("from") ?? localDate(new Date());
    return scenario === "viewer"
      ? reply({ days: sharedDays(state, from) })
      : reply(dataFor(state, from));
  }

  return reply({ error: "invalid_request" }, 400);
}

export async function POST(request: NextRequest, { params }: Context) {
  if (!available()) return new NextResponse(null, { status: 404 });

  const [route, step] = (await params).path;
  const scenario = scenarioOf(request);
  const state = stateFor(scenario);

  if (route === "auth") {
    const next = step === "logout" ? "visitor" : "owner";
    return NextResponse.redirect(new URL(`/routine?sample=${next}`, request.nextUrl.origin), 303);
  }

  const body = await request.json().catch(() => null);

  switch (route) {
    case "item": {
      const action = parseAction(body);
      if (!action) return reply({ error: "invalid_request" }, 400);
      return applyAction(state, action) ? reply({ ok: true }) : reply({ error: "not_owner" }, 403);
    }
    case "organize": {
      await thinking();
      const { status, body: answer } = organizeNote(state, String(body?.note ?? ""), localDate(new Date()));
      return reply(answer, status);
    }
    case "review":
      await thinking();
      return reply({ review: reviewWeek(state, String(body?.week)) });
    case "request":
      state.requested = true;
      return reply({ ok: true });
    case "decide":
      state.pending = state.pending.filter((request) => request.id !== body?.id);
      return reply({ ok: true });
    case "revoke":
      state.active = state.active.filter((viewer) => viewer.id !== body?.id);
      return reply({ ok: true });
    default:
      return reply({ error: "invalid_request" }, 400);
  }
}
