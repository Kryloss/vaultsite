import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTodaysVibe, vibeDay, vibeEmbedUrl, vibeTime, vibeVideoId } from "./todays-vibe.ts";
const meta = { vibe_title: "Jumpsuit", vibe_artist: "twenty one pilots", vibe_date: "2026-09-08" };
test("accepts every YouTube link shape and a bare video ID", () => {
  for (const source of [
    "https://www.youtube.com/watch?v=UOUBW8bkjQ4",
    "https://youtu.be/UOUBW8bkjQ4",
    "https://www.youtube.com/shorts/UOUBW8bkjQ4",
    "  UOUBW8bkjQ4  ",
  ]) assert.equal(vibeVideoId(source), "UOUBW8bkjQ4", source);
  assert.equal(parseTodaysVibe({ ...meta, vibe_youtube: "https://youtu.be/UOUBW8bkjQ4" })?.video, "UOUBW8bkjQ4");
});
test("rejects anything that isn't a single video", () => {
  for (const source of ["", "https://www.youtube.com/playlist?list=PLUHvkEsS44tE", "https://music.apple.com/us/song/123", "javascript:alert(1)", "Jumpsuit", "https://www.youtube.com/watch?v=short"]) assert.equal(vibeVideoId(source), undefined, source);
});
test("the player URL is the nocookie host with YouTube's own interface off", () => {
  const url = new URL(vibeEmbedUrl("UOUBW8bkjQ4", "https://example.com"));
  assert.equal(url.origin, "https://www.youtube-nocookie.com");
  assert.equal(url.pathname, "/embed/UOUBW8bkjQ4");
  assert.equal(url.searchParams.get("origin"), "https://example.com");
  // Playback has to reach the capsule's own button, and nothing may draw itself.
  for (const [key, value] of [["enablejsapi", "1"], ["autoplay", "1"], ["controls", "0"], ["disablekb", "1"], ["fs", "0"], ["rel", "0"], ["playsinline", "1"]]) {
    assert.equal(url.searchParams.get(key), value, key);
  }
  assert.equal(new URL(vibeEmbedUrl("UOUBW8bkjQ4")).searchParams.get("origin"), null);
});
test("a missing video keeps the real pick without pretending to offer sound", () => {
  assert.equal(parseTodaysVibe(meta)?.video, undefined);
  assert.equal(parseTodaysVibe(meta)?.title, "Jumpsuit");
  for (const patch of [{ vibe_title: "" }, { vibe_date: "2026-02-30" }, { vibe_date: new Date() }]) assert.equal(parseTodaysVibe({ ...meta, ...patch }), null);
});
test("selection date follows Toronto across midnight and daylight saving", () => {
  assert.equal(vibeDay(new Date("2026-09-09T03:59:00Z")), "2026-09-08");
  assert.equal(vibeDay(new Date("2026-09-09T04:00:00Z")), "2026-09-09");
  assert.equal(vibeDay(new Date("2026-01-02T04:59:00Z")), "2026-01-01");
  assert.equal(vibeDay(new Date("2026-01-02T05:00:00Z")), "2026-01-02");
});
test("track times handle an unloaded duration", () => {
  assert.equal(vibeTime(NaN), "0:00"); assert.equal(vibeTime(Infinity), "0:00");
  assert.equal(vibeTime(91.9), "1:31"); assert.equal(vibeTime(-1), "0:00");
});
