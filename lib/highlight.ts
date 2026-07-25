/**
 * Build-time syntax highlighting (Shiki).
 *
 * Runs only during `next build` / `next dev` — the highlighted markup is baked
 * into the static HTML, so the browser downloads zero highlighting JavaScript.
 *
 * Dual themes: every token carries `--shiki-light` and `--shiki-dark` CSS
 * variables instead of a hard-coded colour (`defaultColor: false`). The theme
 * swap then happens in CSS via `prefers-color-scheme`, matching how the rest of
 * the site handles dark mode. Backgrounds are ignored — `--code-bg` from
 * globals.css wins, so code blocks sit in the site's palette, not GitHub's.
 */
import { createHighlighter, type Highlighter } from "shiki";

const LIGHT_THEME = "github-light";
const DARK_THEME = "github-dark-dimmed";

/**
 * Languages loaded into the highlighter. Keep this list explicit: loading the
 * full Shiki bundle would pull ~10 MB of grammars into every build for no gain.
 * Common aliases come free (bash/sh/zsh → shellscript, py → python, yml → yaml,
 * js → javascript, ts → typescript, md → markdown, dockerfile → docker).
 * Add a language here when you first want to use it in a note.
 */
const LANGS = [
  "shellscript",
  "shellsession",
  "python",
  "javascript",
  "typescript",
  "tsx",
  "jsx",
  "json",
  "yaml",
  "toml",
  "ini",
  "markdown",
  "html",
  "css",
  "sql",
  "powershell",
  "c",
  "cpp",
  "csharp",
  "go",
  "rust",
  "java",
  "php",
  "ruby",
  "diff",
  "docker",
  "nginx",
  "xml",
  "http",
];

/** One highlighter per build process — creating it loads grammars + WASM. */
let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  return (highlighterPromise ??= createHighlighter({
    themes: [LIGHT_THEME, DARK_THEME],
    langs: LANGS,
  }));
}

/**
 * Metadata from a fence's info string, e.g. ```bash title="scan.sh"
 * Also accepts a bare filename token (```bash scan.sh) since that reads more
 * naturally while writing in Obsidian. Both are ignored by Obsidian's own
 * renderer, so notes still look right in the editor.
 */
export function parseCodeMeta(meta?: string | null): { title?: string } {
  if (!meta) return {};
  const quoted = meta.match(
    /(?:^|\s)title=(?:"([^"]*)"|'([^']*)'|([^\s]+))/
  );
  if (quoted) {
    const title = (quoted[1] ?? quoted[2] ?? quoted[3] ?? "").trim();
    if (title) return { title };
  }
  // Bare filename-ish token: has a dot and no spaces (e.g. nmap-scan.sh).
  const bare = meta
    .trim()
    .split(/\s+/)
    .find((t) => /^[\w@.\-/]+\.[A-Za-z0-9]+$/.test(t));
  return { title: bare };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Highlight source to a hast <pre> element. Unknown languages fall back to
 * plain text rather than throwing, so a typo in a fence can never break a build.
 */
export async function highlightToHast(
  code: string,
  lang: string | undefined
): Promise<any> {
  const hl = await getHighlighter();
  const known = new Set(hl.getLoadedLanguages());
  const resolved = lang && known.has(lang) ? lang : "text";

  const root: any = hl.codeToHast(code, {
    lang: resolved,
    themes: { light: LIGHT_THEME, dark: DARK_THEME },
    // Emit CSS variables instead of baking in one theme's colours.
    defaultColor: false,
  });

  const pre = root.children?.find(
    (c: any) => c.type === "element" && c.tagName === "pre"
  );
  return pre ?? null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Language label shown in a code block's header, or undefined to hide it. */
export function langLabel(lang: string | undefined): string | undefined {
  if (!lang || lang === "text" || lang === "plaintext") return undefined;
  return lang;
}
