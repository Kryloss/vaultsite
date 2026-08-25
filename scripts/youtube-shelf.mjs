/**
 * Read the owner's public YouTube playlist and report which of its videos are
 * not on the shelf yet.
 *
 * Watch history itself is closed: Google removed it from the Data API in 2016,
 * and only Google Takeout still exports it, by hand. A public playlist is the
 * substitute — saving a video to it is two taps in the YouTube app, and the
 * result reads as an Atom feed with no API key, no OAuth and no Google Cloud
 * project. That keeps this on the same keyless footing as the iTunes lookup
 * that fetches album art and the oEmbed call that finds a channel's avatar.
 *
 * The playlist IS the queue. Nothing here records a decision: a video that is
 * in the playlist and not in the vault is pending, every time this runs. To
 * drop one for good, remove it from the playlist — which is the same gesture
 * that put it there.
 *
 * This script is the DETERMINISTIC half of the job: fetch, parse, diff,
 * download. It writes no notes on purpose. A shelf note needs a translated
 * title, descriptions in two languages, categories and a creator bio — that is
 * judgment, not string formatting. `docs/YOUTUBE-SHELF.md` is the workflow
 * that consumes this output and writes the notes.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** The owner's public "Shelf" playlist. */
export const PLAYLIST_ID = "PLUHvkEsS44tE";

/**
 * Mirror of `YOUTUBE_RE` in `lib/youtube.ts`. This script runs as plain
 * `node scripts/…mjs`, with none of the loader hooks `npm test` installs, so
 * it cannot import the TypeScript module. `youtube-shelf.test.mjs` pins the
 * two together the way `validate-image-notes.test.mjs` pins `MAX_INLINE_SVG`,
 * so they cannot drift apart silently.
 */
const YOUTUBE_RE =
  /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:[^\s]*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[?&#][^\s]*)?$/;

/** Extract the 11-character video ID, or undefined if this isn't a video URL. */
export function youtubeId(url) {
  return url.trim().match(YOUTUBE_RE)?.[1];
}

export function feedUrl(playlistId = PLAYLIST_ID) {
  return `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`;
}

const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/**
 * Un-escape a run of feed text. One pass over the named entities, so an
 * escaped `&amp;lt;` decodes to the literal `&lt;` rather than being read
 * twice and turning into a tag.
 */
export function decodeXml(text) {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, name) => NAMED[name]);
}

function tag(xml, name) {
  const match = xml.match(
    new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`)
  );
  return match ? decodeXml(match[1]).trim() : undefined;
}

/**
 * Parse the playlist feed into one record per video.
 *
 * `uploaded` is the field worth the whole exercise: it is the video's own
 * publication date, which `lib/jsonld.ts` needs to emit a `VideoObject` and
 * which the site can otherwise not derive from a link (DECISIONS #41).
 */
export function parseFeed(xml) {
  const videos = [];
  for (const chunk of xml.split("<entry>").slice(1)) {
    const body = chunk.split("</entry>")[0];
    const videoId = tag(body, "yt:videoId");
    if (!videoId) continue;
    videos.push({
      videoId,
      title: tag(body, "title") ?? "",
      channel: tag(body, "name") ?? "",
      channelUrl: tag(body, "uri") ?? "",
      uploaded: (tag(body, "published") ?? "").slice(0, 10),
      description: tag(body, "media:description") ?? "",
      watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    });
  }
  return videos;
}

function walk(dir, out = []) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) walk(full, out);
    else if (item.name.endsWith(".md")) out.push(full);
  }
  return out;
}

/**
 * Every video ID the vault already has a note for, read from the `video:`
 * frontmatter key — the key that puts a video on the shelf. A YouTube link
 * inside a post's body is an illustration, not a shelf entry, so it does not
 * count here and would not stop the same video being shelved later.
 */
export function shelvedVideoIds(vaultDir) {
  const ids = new Set();
  if (!fs.existsSync(vaultDir)) return ids;
  for (const file of walk(vaultDir)) {
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const match = line.match(/^video:\s*(\S+)/);
      if (!match) continue;
      const id = youtubeId(match[1].replace(/^["']|["']$/g, ""));
      if (id) ids.add(id);
    }
  }
  return ids;
}

/** Playlist videos with no note yet, oldest save last (the feed is newest-first). */
export function pendingVideos(videos, shelved) {
  return videos.filter((video) => !shelved.has(video.videoId));
}

/**
 * File-name form of a creator's name, matching what is already in
 * `vault/Shelf/creators/` (`caolan-robertson.jpg`, `nate-herk.jpg`). Anything
 * after a `|` is dropped, the way `entryCreator()` drops it when building
 * initials for a channel written `Nate Herk | AI Automation`.
 *
 * Returns "" for a name with no Latin letters in it at all — a Cyrillic
 * channel like `Андрій Дороничев` has no automatic slug, and the folder's
 * `andrey-doronichev.jpg` shows the answer is a transliteration, which is a
 * judgment call. The `avatar` command refuses rather than guessing.
 */
export function creatorSlug(name) {
  return name
    .split("|")[0]
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * A title reduced to something safe as a file name, keeping the natural words
 * so the note is still findable in Obsidian. Only the characters that break a
 * path or a URL are removed; the slug the site serves is derived from this by
 * `slugify()` as usual.
 */
export function safeFileName(title) {
  return title
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
    .replace(/[.\s]+$/, "");
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; vaultsite-shelf/1.0)" },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} — ${url}`);
  return response.text();
}

/**
 * The channel's avatar, which is the right portrait for a video note because
 * `author:` names the CHANNEL, not its host. `og:image` on the channel page is
 * already square and needs no cropping decision — see the sourcing cascade in
 * `docs/CONTENT-WORKFLOW.md`.
 */
export async function channelAvatarUrl(channelUrl) {
  const html = await fetchText(channelUrl);
  return html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
}

/** The video's own publication date, for `uploaded:` on an already-shelved note. */
export async function fetchUploadDate(videoId) {
  const html = await fetchText(`https://www.youtube.com/watch?v=${videoId}`);
  return html.match(/"uploadDate":"([0-9]{4}-[0-9]{2}-[0-9]{2})/)?.[1];
}

async function downloadAvatar(channelUrl, slug, vaultDir) {
  const source = await channelAvatarUrl(channelUrl);
  if (!source) throw new Error(`no og:image on ${channelUrl}`);
  const { default: sharp } = await import("sharp");
  const bytes = Buffer.from(await (await fetch(source)).arrayBuffer());
  const dest = path.join(vaultDir, "Shelf", "creators", `${slug}.jpg`);
  // 320px square, matching every other portrait in that folder: the creator
  // block renders it at 6rem and the reset would otherwise ship a 900px file.
  await sharp(bytes).resize(320, 320, { fit: "cover" }).jpeg({ quality: 88 }).toFile(dest);
  return dest;
}

const ROOT = path.resolve(fileURLToPath(import.meta.url), "..", "..");

async function main(argv) {
  const [command = "pending", ...rest] = argv;
  const vaultDir = path.join(ROOT, "vault");

  if (command === "pending") {
    const playlist = rest[0] ?? PLAYLIST_ID;
    const videos = parseFeed(await fetchText(feedUrl(playlist)));
    const pending = pendingVideos(videos, shelvedVideoIds(vaultDir));
    console.log(JSON.stringify(pending, null, 2));
    console.error(
      `[youtube-shelf] ${videos.length} in playlist, ${pending.length} not on the shelf`
    );
    return;
  }

  if (command === "avatar") {
    const [channelUrl, name] = rest;
    if (!channelUrl || !name) throw new Error("usage: avatar <channel-url> <creator name>");
    const slug = creatorSlug(name);
    if (!slug) {
      throw new Error(
        `no Latin slug for "${name}" — pass a transliterated name, as vault/Shelf/creators/andrey-doronichev.jpg does`
      );
    }
    const dest = await downloadAvatar(channelUrl, slug, vaultDir);
    console.log(path.relative(ROOT, dest));
    return;
  }

  if (command === "uploaded") {
    const [videoId] = rest;
    if (!videoId) throw new Error("usage: uploaded <video-id>");
    console.log((await fetchUploadDate(videoId)) ?? "");
    return;
  }

  throw new Error(`unknown command: ${command}`);
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) await main(process.argv.slice(2));
