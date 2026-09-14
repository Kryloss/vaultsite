/**
 * Instagram links: which shapes become a player, and which stay links.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  instagramCrop,
  instagramEmbedHtml,
  instagramEmbedUrl,
  instagramMeasure,
  instagramNeedsRemeasure,
  instagramPost,
} from "./instagram.ts";

test("the crop keeps exactly the media, at the heights the embed really reported", () => {
  // A landscape reel, measured in the browser at two widths.
  assert.deepEqual(instagramCrop(368, 284), { top: 54, media: 160, landscape: true });
  assert.deepEqual(instagramCrop(405, 350), { top: 54, media: 197, landscape: true });
  // A 9:16 reel at 350px: 622px of video under the same header and footer.
  assert.deepEqual(instagramCrop(830, 350), { top: 54, media: 622, landscape: false });
});

test("a shape no post could have leaves the frame uncropped", () => {
  assert.equal(instagramCrop(150, 350), undefined); // less than the chrome itself
  assert.equal(instagramCrop(260, 350), undefined); // a sliver of media
  assert.equal(instagramCrop(2400, 350), undefined); // far taller than 9:16
  assert.equal(instagramCrop(405, 0), undefined); // a hidden frame
});

test("a MEASURE message gives the frame's height; nothing else does", () => {
  assert.equal(instagramMeasure('{"details":{"height":368},"type":"MEASURE"}'), 368);
  assert.equal(instagramMeasure('{"details":{"height":367.6},"type":"MEASURE"}'), 368);
  for (const data of [
    '{"details":{},"type":"LOADING"}',
    '{"details":{"styles":[]},"type":"MOUNTED"}',
    '{"details":{"height":"368"},"type":"MEASURE"}',
    '{"details":{"height":0},"type":"MEASURE"}',
    '{"details":{"height":99999},"type":"MEASURE"}',
    "not json",
    "null",
    { type: "MEASURE", details: { height: 368 } },
  ]) assert.equal(instagramMeasure(data), undefined, String(data));
});

test("only a real width change re-measures, never a hidden or unmeasured frame", () => {
  assert.equal(instagramNeedsRemeasure(284, 352), true);
  assert.equal(instagramNeedsRemeasure(352, 284), true);
  assert.equal(instagramNeedsRemeasure(284, 290), false);
  assert.equal(instagramNeedsRemeasure(284, 0), false);
  assert.equal(instagramNeedsRemeasure(0, 352), false);
});

test("accepts reel, post and tv links, with or without the account segment", () => {
  const cases: [string, string, string][] = [
    ["https://www.instagram.com/reel/Da7-rSIhsj7/?utm_source=ig_web_copy_link&stkn=MzRlODBiNWFlZA==", "reel", "Da7-rSIhsj7"],
    ["https://www.instagram.com/hanna.charivna/reel/Da7-rSIhsj7/", "reel", "Da7-rSIhsj7"],
    ["https://instagram.com/reels/Da7-rSIhsj7", "reel", "Da7-rSIhsj7"],
    ["https://www.instagram.com/p/C_abc123/", "p", "C_abc123"],
    ["https://www.instagram.com/tv/B12345/", "tv", "B12345"],
  ];
  for (const [url, kind, id] of cases) assert.deepEqual(instagramPost(url), { kind, id }, url);
});

test("profiles, stories and other hosts are not posts", () => {
  for (const url of [
    "https://www.instagram.com/itskyrylo",
    "https://www.instagram.com/stories/hanna.charivna/123/",
    "https://www.instagram.com.evil.example/reel/Da7-rSIhsj7/",
    "javascript:alert(1)",
    "https://www.youtube.com/watch?v=UOUBW8bkjQ4",
  ]) assert.equal(instagramPost(url), undefined, url);
});

test("the embed drops tracking parameters and is a plain iframe", () => {
  const post = instagramPost("https://www.instagram.com/reel/Da7-rSIhsj7/?utm_source=x")!;
  assert.equal(instagramEmbedUrl(post), "https://www.instagram.com/reel/Da7-rSIhsj7/embed/");
  const html = instagramEmbedHtml(post);
  assert.match(html, /<iframe class="instagram-embed instagram-embed-reel"/);
  assert.doesNotMatch(html, /<script|utm_source/);
});
