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
  "lib/routine-access.ts",
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

test("the site has no middleware, so only the API routes run per request", () => {
  const root = readdirSync(".");
  assert.equal(root.some((name) => /^(middleware|proxy)\./.test(name)), false);
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
