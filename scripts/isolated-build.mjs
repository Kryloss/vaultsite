#!/usr/bin/env node
// Build the site in a throwaway copy of the tree, so `next build` never
// touches the `.next/` a running `npm run dev` is serving from (the two share
// that directory and a build corrupts the dev server's output). node_modules
// is symlinked, not copied. See docs/VERIFY.md.
import { cpSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const skip = /^(node_modules|\.next|\.git|public\/vault-assets|\.image-manifest\.json|tsconfig\.tsbuildinfo)(\/|$)/;
const dir = mkdtempSync(join(tmpdir(), "vaultsite-build-"));

try {
  cpSync(root, dir, {
    recursive: true,
    filter: (src) => !skip.test(src.slice(root.length + 1)),
  });
  symlinkSync(join(root, "node_modules"), join(dir, "node_modules"), "dir");
  console.log(`building in ${dir}`);
  const r = spawnSync("npm", ["run", "build"], {
    cwd: dir,
    stdio: "inherit",
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  });
  process.exitCode = r.status ?? 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
