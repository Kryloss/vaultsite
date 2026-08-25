import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  parseFeed,
  decodeXml,
  shelvedVideoIds,
  pendingVideos,
  creatorSlug,
  safeFileName,
  feedUrl,
  youtubeId,
} from "./youtube-shelf.mjs";
import { youtubeId as libYoutubeId } from "@/lib/youtube";

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
 <title>Shelf</title>
 <entry>
  <yt:videoId>hvXOIjjkSHM</yt:videoId>
  <title>Bikes &amp; Blackouts &#8212; a report</title>
  <author><name>varlamov</name><uri>https://www.youtube.com/channel/UC101o-vQ2iOj9vr00JUlyKw</uri></author>
  <published>2026-08-04T12:00:28+00:00</published>
  <media:group><media:description>Two lines
here</media:description></media:group>
 </entry>
 <entry>
  <yt:videoId>3DA7EXbf_d4</yt:videoId>
  <title>Already shelved</title>
  <author><name>Caolan Robertson</name><uri>https://www.youtube.com/channel/UCabc</uri></author>
  <published>2026-07-21T04:25:22-07:00</published>
  <media:group><media:description></media:description></media:group>
 </entry>
</feed>`;

test("parseFeed pulls one record per video", () => {
  const videos = parseFeed(FEED);
  assert.equal(videos.length, 2);
  const [first] = videos;
  assert.equal(first.videoId, "hvXOIjjkSHM");
  assert.equal(first.channel, "varlamov");
  assert.equal(first.watchUrl, "https://www.youtube.com/watch?v=hvXOIjjkSHM");
  assert.equal(first.thumbnail, "https://i.ytimg.com/vi/hvXOIjjkSHM/hqdefault.jpg");
});

test("uploaded is the video's own date, trimmed to a day", () => {
  // The whole point of reading the feed: lib/jsonld.ts needs this to emit a
  // VideoObject, and a link alone can never supply it (DECISIONS #41).
  assert.equal(parseFeed(FEED)[0].uploaded, "2026-08-04");
  assert.equal(parseFeed(FEED)[1].uploaded, "2026-07-21");
});

test("feed text is un-escaped, and entities decode once", () => {
  assert.equal(parseFeed(FEED)[0].title, "Bikes & Blackouts — a report");
  assert.equal(decodeXml("&amp;lt;"), "&lt;");
  assert.equal(decodeXml("<![CDATA[raw & text]]>"), "raw & text");
});

test("an empty description is a string, not undefined", () => {
  assert.equal(parseFeed(FEED)[1].description, "");
});

test("shelvedVideoIds reads the video: key, not links in the body", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yt-shelf-"));
  fs.mkdirSync(path.join(dir, "Shelf"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "Shelf", "shelved.md"),
    "---\nvideo: https://www.youtube.com/watch?v=3DA7EXbf_d4\n---\n"
  );
  fs.writeFileSync(
    path.join(dir, "Shelf", "post.md"),
    "---\ntitle: A post\n---\n\nhttps://www.youtube.com/watch?v=hvXOIjjkSHM\n"
  );
  const ids = shelvedVideoIds(dir);
  assert.deepEqual([...ids], ["3DA7EXbf_d4"]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("pendingVideos drops what is already shelved", () => {
  const pending = pendingVideos(parseFeed(FEED), new Set(["3DA7EXbf_d4"]));
  assert.deepEqual(pending.map((v) => v.videoId), ["hvXOIjjkSHM"]);
});

test("the mirrored video-ID regex matches lib/youtube.ts", () => {
  // Same pinning as validate-image-notes.test.mjs does for MAX_INLINE_SVG:
  // the script cannot import the TypeScript module, so a test holds them together.
  for (const url of [
    "https://www.youtube.com/watch?v=3DA7EXbf_d4",
    "https://youtu.be/3DA7EXbf_d4",
    "https://www.youtube.com/shorts/gDbk6NS7cT4",
    "https://www.youtube.com/live/3DA7EXbf_d4?feature=share",
    "https://example.com/not-a-video",
    "3DA7EXbf_d4",
  ]) {
    assert.equal(youtubeId(url), libYoutubeId(url), url);
  }
});

test("creatorSlug matches the names already in vault/Shelf/creators", () => {
  assert.equal(creatorSlug("Caolan Robertson"), "caolan-robertson");
  assert.equal(creatorSlug("Nate Herk | AI Automation"), "nate-herk");
  assert.equal(creatorSlug("varlamov"), "varlamov");
});

test("creatorSlug gives up on a name with no Latin letters", () => {
  // An empty slug is what makes the avatar command refuse instead of writing
  // a file called ".jpg"; transliteration is a judgment call, not a rule.
  assert.equal(creatorSlug("Андрій Дороничев"), "");
});

test("safeFileName keeps the words and drops what breaks a path", () => {
  assert.equal(safeFileName('A/B: test? "quoted"'), "AB test quoted");
  assert.equal(safeFileName("Trailing dots... "), "Trailing dots");
  assert.ok(safeFileName("x".repeat(200)).length <= 80);
});

test("feedUrl targets the playlist feed", () => {
  assert.equal(
    feedUrl("PLUHvkEsS44tE"),
    "https://www.youtube.com/feeds/videos.xml?playlist_id=PLUHvkEsS44tE"
  );
});
