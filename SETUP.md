# One-time setup

Do these once, in order. After that, publishing = writing a note in Obsidian.

## 1. Push to GitHub

```bash
cd Vaultsite
git init
git add -A
git commit -m "Initial commit: vaultsite"
```

Create a repo on [github.com/new](https://github.com/new) (private is fine — Vercel can deploy private repos), then:

```bash
git remote add origin https://github.com/<your-username>/vaultsite.git
git branch -M main
git push -u origin main
```

## 2. Deploy on Vercel

1. Go to [vercel.com/new](https://vercel.com/new), sign in with GitHub.
2. Import the `vaultsite` repo. Framework preset: **Next.js**. No env vars needed. Deploy.
3. Every future push to `main` now redeploys automatically.
4. Optional: add a custom domain under Project → Settings → Domains.

## 3. Set up Obsidian

1. Install [Obsidian](https://obsidian.md).
2. **Open the `Vaultsite` folder itself as your vault** (Open folder as vault). The repo root must be the vault root — that's what makes the git plugin work. You'll see code folders (`app/`, `lib/`…) in the file explorer; ignore them, you only ever work inside `vault/`.
3. Settings → **Files and links**:
   - *Default location for new attachments* → **Same folder as current file** (required — images must sit next to the note that uses them)
   - *Excluded files* → add `node_modules` and `.next` (keeps search clean)
4. Settings → **Community plugins** → turn off Restricted mode → Browse → install and enable **Git** (by Vinzent).
5. Git plugin settings:
   - *Split automatic commit and push* → off (commit-and-sync together)
   - *Auto commit-and-sync interval* → `10` minutes (or your preference)
   - *Pull on startup* → on
   - *Commit message* → e.g. `vault: {{date}}`

If the plugin asks for authentication on push, use a GitHub **personal access token** (github.com → Settings → Developer settings → Fine-grained tokens → access to the vaultsite repo, Contents: read/write) as the password.

## 4. Daily workflow

1. Open Obsidian, write in `vault/`.
2. Within your auto-sync interval (or via command palette: *Git: Commit-and-sync*), changes push to GitHub.
3. ~1 minute later the site is updated.

New page = new folder in `vault/` containing a `main.md`. New post = new `.md` file in that folder. That's it.

## Troubleshooting

- **Post not showing up?** Check frontmatter — `draft: true` or `published: false` hides it. Also confirm the push happened (Git plugin status bar) and the Vercel build succeeded (vercel.com dashboard).
- **Image broken?** The image file must be inside the same section folder as the note (e.g. `vault/Posts/photo.png`).
- **Vercel build failed?** Open the build log in the Vercel dashboard — usually a malformed frontmatter block (missing closing `---`).
