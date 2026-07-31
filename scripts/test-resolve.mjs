/**
 * Module resolution for `npm test`, so Node's own test runner can import the
 * site's modules unchanged.
 *
 * Two gaps between how TypeScript resolves imports and how Node does:
 *
 * - `@/lib/x` — the path alias from tsconfig.json, which Node knows nothing
 *   about. Rewritten to a path from the repo root.
 * - `./x` with no extension — legal in TypeScript, not in Node's ESM
 *   resolver. Retried as `./x.ts`, then `./x.tsx`.
 *
 * The alternative was writing extensions into every import in lib/, which
 * would make the source worse to read in order to make the tests possible.
 * Registered by scripts/test-hooks.mjs, which the `test` script `--import`s.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const EXTENSIONS = [".ts", ".tsx", "/index.ts"];

export async function resolve(specifier, context, nextResolve) {
  const spec = specifier.startsWith("@/")
    ? pathToFileURL(path.join(ROOT, specifier.slice(2))).href
    : specifier;

  try {
    return await nextResolve(spec, context);
  } catch (error) {
    // Only relative and absolute specifiers get the extension treatment —
    // a missing npm package should still fail as a missing npm package.
    const local = spec.startsWith(".") || spec.startsWith("/") || spec.startsWith("file:");
    if (!local) throw error;

    for (const extension of EXTENSIONS) {
      try {
        return await nextResolve(spec + extension, context);
      } catch {
        /* try the next one */
      }
    }
    throw error;
  }
}
