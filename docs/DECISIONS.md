# Decision log

Append new entries at the bottom. Format: number, date, decision, why, revisit-when.

## 1. Git-based publishing, no Supabase for content (2026-07-16)

**Decision:** Content flows Obsidian → Git → Vercel rebuild. Supabase is NOT part of the content pipeline.
**Why:** Markdown in git is already a versioned database; a DB sync layer would add webhooks, auth, and failure modes for ~1 minute of publish latency saved. An unused free-tier Supabase project would also auto-pause.
**Revisit when:** Dynamic features are needed (view counts, reactions, comments, AMA). Then add Supabase for those features only — content stays in git.

## 2. Vault root = repo root (2026-07-16)

**Decision:** The whole repo is opened as the Obsidian vault; content lives in `vault/`.
**Why:** The Obsidian Git plugin is most reliable when the git repo root is the vault root. Cost: code folders visible in Obsidian's explorer (harmless; excluded from search via settings).
**Revisit when:** Obsidian Git gains first-class support for vaults nested inside repos, or a two-repo split becomes worth it.

## 3. Images mirrored to public/ at build time (2026-07-16)

**Decision:** `scripts/sync-assets.mjs` copies non-md vault files to `public/vault-assets/` (prebuild/predev hook), instead of a runtime file-serving route.
**Why:** Keeps the site 100% static, works identically in dev/prod, no serverless file-tracing config.
**Revisit when:** Media volume makes the repo heavy (>~1 GB) — then move media to Supabase Storage or Vercel Blob.

## 4. Regex preprocessing for Obsidian syntax (2026-07-16)

**Decision:** `![[embeds]]` and `[[wiki links]]` are converted with regex before the unified pipeline, rather than a remark plugin.
**Why:** Two small, readable regexes vs. an AST plugin dependency. Wiki links resolve within the same section only.
**Revisit when:** Cross-section wiki links or embed transclusion (`![[Other Note]]` embedding note content) are needed.

## 5. Fully static generation, `dynamicParams = false` (2026-07-16)

**Decision:** Every route is pre-rendered at build; unknown paths 404 at the CDN.
**Why:** Fastest possible site, zero runtime dependencies, free tier friendly. Content only changes via git push anyway, which always triggers a rebuild.
**Revisit when:** Content volume makes builds slow (hundreds of posts) — then consider ISR.

## 6. Apple Music via free iframe embeds, not MusicKit (2026-07-16)

**Decision:** The `music` section type embeds playlists with `embed.music.apple.com` iframes (host swap of a normal share link). Section frontmatter is exposed as `section.meta` so types can read custom keys (`playlists:`).
**Why:** MusicKit/Apple Music API requires a paid Apple Developer account ($99/yr); iframe embeds are free, need no keys, and auto-match the visitor's light/dark theme. Brian Lovin's /listening (Spotify history sync) would need an API server + cron — out of scope for a static site.
**Revisit when:** Live "recently played" history is wanted — needs an API route + provider account (Spotify or MusicKit) + Supabase/KV for tokens.

## 7. Drawer sidebar hidden by default + emoji→SVG icon mapping (2026-07-17)

**Decision:** Sidebar starts hidden at every viewport size and slides in from a header menu button; the sticky header shows "<Section> · Kyrylo". Vault `icon:` frontmatter stays emoji-based, but known emoji are swapped for inline SVG icons at render time (`components/icons.tsx`), with unknown emoji rendering as-is.
**Why:** Owner preference (brianlovin-style minimal chrome). Mapping emoji→SVG keeps the Obsidian workflow unchanged — no new frontmatter syntax to learn — while the site gets crisp monochrome icons.
**Revisit when:** A persistent desktop sidebar is wanted again (restore from git history) or the icon set outgrows hand-drawn SVGs (consider lucide-react).
