import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** The promises in docs/ROUTINE.md that a code change could quietly break. */

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

const routineCode = [
  ...files("app/api/routine"),
  ...files("supabase"),
  "app/routine/page.tsx",
  "components/RoutineAccess.tsx",
  "components/RoutineOrganizer.tsx",
  "components/RoutineShared.tsx",
  "lib/routine-access.ts",
  "lib/routine-model.ts",
  "lib/routine-server.ts",
];

test("no email address sits in routine code, since the repository is public", () => {
  for (const path of routineCode) {
    const addresses = readFileSync(path, "utf8").match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) ?? [];
    assert.deepEqual(addresses, [], path);
  }
});

test("the site has no service-role key and no public Supabase setting", () => {
  for (const path of routineCode) {
    if (path.startsWith("supabase")) continue;
    const source = readFileSync(path, "utf8");
    assert.doesNotMatch(source, /SERVICE_ROLE|service_role|NEXT_PUBLIC_/, path);
  }
});

test("the page stays static and nothing in the browser imports the server half", () => {
  const page = readFileSync("app/routine/page.tsx", "utf8");
  assert.doesNotMatch(page, /force-dynamic|next\/headers|routine-server/);
  const client = readFileSync("components/RoutineAccess.tsx", "utf8");
  assert.doesNotMatch(client, /routine-server|next\/headers|dangerouslySetInnerHTML/);
});

test("a viewer's week only ever comes from the sanitizing function", () => {
  const route = readFileSync("app/api/routine/data/route.ts", "utf8");
  const viewerBranch = route.slice(route.indexOf('"viewer"'), route.indexOf('!== "owner"'));
  assert.match(viewerBranch, /routine_shared_days/);
  assert.doesNotMatch(viewerBranch, /\.from\(/);

  const sql = readFileSync("supabase/migrations/20261030210000_routine_organizer.sql", "utf8");
  const shared = sql.slice(sql.indexOf("create function public.routine_shared_days"));
  assert.doesNotMatch(shared, /location|notes|routine_habits|routine_logs/);
});

test("Gemini can't change what a viewer sees, and it has no key to leak", () => {
  const sql = readFileSync("supabase/migrations/20261030220000_routine_gemini.sql", "utf8");
  const apply = sql.slice(
    sql.indexOf("create function public.routine_apply_gemini"),
    sql.indexOf("create function public.routine_undo_batch")
  );
  assert.doesNotMatch(apply, /shareable|access_grants|access_requests|private\.owner/);

  const gemini = readFileSync("lib/routine-gemini.ts", "utf8");
  assert.doesNotMatch(gemini.slice(0, gemini.indexOf("function time(")).replace(/\/\*[\s\S]*?\*\//g, ""), /shareable/);

  const vertex = readFileSync("lib/routine-vertex.ts", "utf8");
  assert.doesNotMatch(vertex, /API_KEY|private_key|GOOGLE_APPLICATION_CREDENTIALS/);
});

test("only the owner's organize and review routes reach Gemini", () => {
  const callers = files("app/api/routine").filter((path) =>
    readFileSync(path, "utf8").includes("askGemini")
  );
  assert.deepEqual(callers.sort(), ["app/api/routine/organize/route.ts", "app/api/routine/review/route.ts"]);

  const route = readFileSync("app/api/routine/organize/route.ts", "utf8");
  assert.ok(route.indexOf('rpc("routine_ai_reserve"') < route.indexOf("askGemini(systemPrompt"));
  assert.ok(route.indexOf("parseAnswer(result") < route.indexOf('rpc("routine_apply_gemini"'));

  const review = readFileSync("app/api/routine/review/route.ts", "utf8");
  assert.ok(review.indexOf('rpc("routine_ai_reserve"') < review.indexOf("askGemini(reviewSystemPrompt"));
  assert.ok(review.indexOf("parseReview(result") < review.indexOf('from("routine_reviews")'));
});

test("a review can only write a review", () => {
  const review = readFileSync("app/api/routine/review/route.ts", "utf8");
  assert.deepEqual(
    [...review.matchAll(/\.(insert|update|upsert|delete)\(/g)].map(([, method]) => method),
    ["upsert"]
  );
  assert.doesNotMatch(review, /routine_apply_gemini/);
});

test("the phone install declares itself without leaving the page indexable", () => {
  const manifest = JSON.parse(readFileSync("public/routine.webmanifest", "utf8"));
  assert.equal(manifest.start_url, "/routine");
  assert.equal(manifest.display, "standalone");
  for (const icon of manifest.icons) {
    assert.ok(statSync(join("public", icon.src)).size > 0, icon.src);
  }
  const page = readFileSync("app/routine/page.tsx", "utf8");
  assert.match(page, /manifest: "\/routine\.webmanifest"/);
  assert.match(page, /appleWebApp/);
  assert.ok(statSync("public/routine-icon-180.png").size > 0);
});

test("the site has no middleware, so only the API routes run per request", () => {
  const root = readdirSync(".");
  assert.equal(root.some((name) => /^(middleware|proxy)\./.test(name)), false);
});

test("the organizer's write routes check for a session before touching data", () => {
  for (const path of [
    "app/api/routine/item/route.ts",
    "app/api/routine/organize/route.ts",
    "app/api/routine/review/route.ts",
  ]) {
    const source = readFileSync(path, "utf8");
    const signedIn = source.indexOf("auth.getUser()");
    assert.ok(signedIn > 0, path);
    assert.ok(signedIn < source.indexOf(".rpc("), path);
  }
  const item = readFileSync("app/api/routine/item/route.ts", "utf8");
  assert.ok(item.indexOf("auth.getUser()") < item.indexOf("supabase.from("));
});

test("every routine API route that changes state checks where it came from", () => {
  for (const path of files("app/api/routine")) {
    const source = readFileSync(path, "utf8");
    if (source.includes("export async function POST")) {
      assert.match(source, /fromOwnSite\(request\)/, path);
    }
  }
});

test("identity is read from auth.identities, never from user_metadata", () => {
  for (const path of files("supabase")) {
    const code = readFileSync(path, "utf8").replace(/--.*$/gm, "");
    assert.doesNotMatch(code, /raw_user_meta_data|user_metadata/, path);
  }
});

test("/routine stays out of the search engines", () => {
  assert.match(readFileSync("app/routine/page.tsx", "utf8"), /robots: \{ index: false/);
  assert.doesNotMatch(readFileSync("app/sitemap.ts", "utf8"), /\/routine/);
});
