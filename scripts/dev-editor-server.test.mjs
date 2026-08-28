import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createDevEditorServer } from "./dev-editor-server.mjs";

const SOURCE = "vault/Posts/Note.md";
const ORIGINAL = `---
title: Original
title_uk: Оригінал
description: Before.
description_uk: Раніше.
---
Body.
`;

async function fixture(t) {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "vault-editor-http-"));
  const file = path.join(root, SOURCE);
  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  await fs.promises.writeFile(file, ORIGINAL);

  const server = createDevEditorServer({ repoRoot: root });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");

  t.after(async () => {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
    await fs.promises.rm(root, { recursive: true, force: true });
  });
  return { base: `http://127.0.0.1:${address.port}`, file };
}

async function payload(response) {
  return response.json();
}

async function session(base, headers = { Origin: "http://localhost:3000" }) {
  const response = await fetch(`${base}/session`, { headers });
  const body = await payload(response);
  return { response, body, token: body.token };
}

function editorHeaders(token, extra = {}) {
  return {
    Origin: "http://localhost:3000",
    "Content-Type": "application/json",
    "X-Vault-Editor-Token": token,
    ...extra,
  };
}

test("accepts exact localhost Origin and falls back to localhost Referer", async (t) => {
  const { base } = await fixture(t);

  const byOrigin = await session(base, { Origin: "http://localhost:3000" });
  assert.equal(byOrigin.response.status, 200);
  assert.match(byOrigin.token, /^[A-Za-z0-9_-]{43}$/);

  const byReferer = await session(base, {
    Referer: "http://localhost:3000/music/voiny-sveta",
  });
  assert.equal(byReferer.response.status, 200);
  assert.equal(byReferer.token, byOrigin.token);
});

test("rejects numeric-loopback, foreign, missing, and contradictory origins", async (t) => {
  const { base } = await fixture(t);
  const rejected = [
    { Origin: "http://127.0.0.1:3000" },
    { Origin: "http://localhost:3001" },
    { Origin: "http://localhost.example.com:3000" },
    { Origin: "https://example.com" },
    {},
    {
      Origin: "https://example.com",
      Referer: "http://localhost:3000/music/voiny-sveta",
    },
  ];

  for (const headers of rejected) {
    const response = await fetch(`${base}/session`, { headers });
    assert.equal(response.status, 403);
    assert.equal((await payload(response)).code, "bad_origin");
  }
});

test("requires the current session token", async (t) => {
  const { base } = await fixture(t);
  const { token } = await session(base);

  for (const supplied of [undefined, "not-the-token"]) {
    const headers = editorHeaders(supplied ?? "");
    if (supplied === undefined) delete headers["X-Vault-Editor-Token"];
    const response = await fetch(`${base}/document`, {
      method: "POST",
      headers,
      body: JSON.stringify({ source: SOURCE }),
    });
    assert.equal(response.status, 403);
    assert.equal((await payload(response)).code, "unauthorized");
  }

  const accepted = await fetch(`${base}/document`, {
    method: "POST",
    headers: editorHeaders(token),
    body: JSON.stringify({ source: SOURCE }),
  });
  assert.equal(accepted.status, 200);
});

test("requires the exact application/json media type", async (t) => {
  const { base } = await fixture(t);
  const { token } = await session(base);

  for (const contentType of ["text/plain", "application/jsonp"]) {
    const response = await fetch(`${base}/document`, {
      method: "POST",
      headers: editorHeaders(token, { "Content-Type": contentType }),
      body: JSON.stringify({ source: SOURCE }),
    });
    assert.equal(response.status, 415);
    assert.equal((await payload(response)).code, "bad_content_type");
  }

  const accepted = await fetch(`${base}/document`, {
    method: "POST",
    headers: editorHeaders(token, {
      "Content-Type": "application/json; charset=utf-8",
    }),
    body: JSON.stringify({ source: SOURCE }),
  });
  assert.equal(accepted.status, 200);
});

test("rejects malformed and oversized JSON before touching the vault", async (t) => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "vault-editor-http-"));
  const file = path.join(root, SOURCE);
  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  await fs.promises.writeFile(file, ORIGINAL);
  const server = createDevEditorServer({ repoRoot: root, maxBody: 32 });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  t.after(async () => {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
    await fs.promises.rm(root, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${address.port}`;
  const { token } = await session(base);

  const malformed = await fetch(`${base}/document`, {
    method: "POST",
    headers: editorHeaders(token),
    body: "{",
  });
  assert.equal(malformed.status, 400);
  assert.equal((await payload(malformed)).code, "bad_json");

  const oversized = await fetch(`${base}/document`, {
    method: "POST",
    headers: editorHeaders(token),
    body: JSON.stringify({ source: "x".repeat(64) }),
  });
  assert.equal(oversized.status, 413);
  assert.equal((await payload(oversized)).code, "too_large");
  assert.equal(await fs.promises.readFile(file, "utf8"), ORIGINAL);
});

test("reads, saves, and reports a stale revision conflict over HTTP", async (t) => {
  const { base, file } = await fixture(t);
  const { token } = await session(base);

  const openedResponse = await fetch(`${base}/document`, {
    method: "POST",
    headers: editorHeaders(token),
    body: JSON.stringify({ source: SOURCE }),
  });
  assert.equal(openedResponse.status, 200);
  const opened = await payload(openedResponse);
  assert.equal(opened.fields.description, "Before.");
  assert.match(opened.revision, /^[a-f0-9]{64}$/);

  const savedResponse = await fetch(`${base}/save`, {
    method: "POST",
    headers: editorHeaders(token),
    body: JSON.stringify({
      source: SOURCE,
      revision: opened.revision,
      changes: { description: "Saved through HTTP." },
    }),
  });
  assert.equal(savedResponse.status, 200);
  const saved = await payload(savedResponse);
  assert.equal(saved.fields.description, "Saved through HTTP.");
  assert.notEqual(saved.revision, opened.revision);
  assert.match(await fs.promises.readFile(file, "utf8"), /description: Saved through HTTP\./);

  const conflictResponse = await fetch(`${base}/save`, {
    method: "POST",
    headers: editorHeaders(token),
    body: JSON.stringify({
      source: SOURCE,
      revision: opened.revision,
      changes: { description: "Overwrite newer text." },
    }),
  });
  assert.equal(conflictResponse.status, 409);
  assert.equal((await payload(conflictResponse)).code, "revision_conflict");
  assert.match(await fs.promises.readFile(file, "utf8"), /description: Saved through HTTP\./);
});

test("rejects unsupported methods and never opts into CORS", async (t) => {
  const { base } = await fixture(t);
  const established = await session(base);
  assert.equal(established.response.headers.get("access-control-allow-origin"), null);

  const methodResponse = await fetch(`${base}/document`, {
    method: "PUT",
    headers: editorHeaders(established.token),
    body: JSON.stringify({ source: SOURCE }),
  });
  assert.equal(methodResponse.status, 405);
  assert.equal((await payload(methodResponse)).code, "method_not_allowed");
  assert.equal(methodResponse.headers.get("access-control-allow-origin"), null);

  const preflight = await fetch(`${base}/document`, {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:3000",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type,x-vault-editor-token",
    },
  });
  assert.equal(preflight.status, 405);
  assert.equal(preflight.headers.get("access-control-allow-origin"), null);

  const foreign = await fetch(`${base}/session`, {
    headers: { Origin: "https://example.com" },
  });
  assert.equal(foreign.status, 403);
  assert.equal(foreign.headers.get("access-control-allow-origin"), null);
});
