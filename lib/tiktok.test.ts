/**
 * TikTok links: which shapes become a player, and what the player is told.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { tiktokEmbedHtml, tiktokEmbedUrl, tiktokId } from "./tiktok.ts";

const ID = "7683987896038296839";

test("accepts a video page, the v2 embed and the player, tracking dropped", () => {
  for (const url of [
    `https://www.tiktok.com/@cbccalgary/video/${ID}?_r=1&_t=ZS-99jd935ZuuD`,
    `https://www.tiktok.com/@cbccalgary/video/${ID}`,
    `https://m.tiktok.com/@cbc.calgary_1/video/${ID}/`,
    `https://www.tiktok.com/embed/v2/${ID}`,
    `https://www.tiktok.com/player/v1/${ID}?controls=0`,
  ]) assert.equal(tiktokId(url), ID, url);
});

test("short links, profiles and other hosts are not videos", () => {
  for (const url of [
    "https://vt.tiktok.com/ZSqCSS1mR/",
    "https://www.tiktok.com/@cbccalgary",
    `https://www.tiktok.com.evil.example/@cbccalgary/video/${ID}`,
    "https://www.tiktok.com/@cbccalgary/video/123",
    "javascript:alert(1)",
  ]) assert.equal(tiktokId(url), undefined, url);
});

test("the player keeps its controls and drops TikTok's extra layers", () => {
  const url = new URL(tiktokEmbedUrl(ID));
  assert.equal(url.origin + url.pathname, `https://www.tiktok.com/player/v1/${ID}`);
  for (const key of ["music_info", "description", "rel", "native_context_menu", "closed_caption"]) {
    assert.equal(url.searchParams.get(key), "0", key);
  }
  assert.equal(url.searchParams.has("controls"), false);
  assert.equal(url.searchParams.has("autoplay"), false);
});

test("the embed is a plain iframe with its ampersands escaped", () => {
  const html = tiktokEmbedHtml(ID);
  assert.match(html, /^<div class="tiktok-block"><iframe class="tiktok-embed" /);
  assert.match(html, /music_info=0&amp;description=0/);
  assert.doesNotMatch(html, /<script|autoplay/);
});
