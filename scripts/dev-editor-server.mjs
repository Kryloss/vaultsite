import { randomBytes, timingSafeEqual } from "node:crypto";
import http from "node:http";
import {
  DevEditorError,
  createEntry,
  readDocument,
  readPageDocument,
  reorderDocuments,
  saveDocument,
  savePageDocument,
  toggleNowGoal,
} from "./dev-editor-core.mjs";

// A page save may carry both language bodies. Each one is capped separately
// at 512 KiB by the core, with room here for JSON escaping and metadata.
const DEFAULT_MAX_BODY = 2 * 1024 * 1024;

function expectedLocalUrl(value, expectedOrigin) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname === "localhost" &&
      url.origin === expectedOrigin
    );
  } catch {
    return false;
  }
}

function sameOriginBrowser(req, expectedOrigin) {
  const fetchSite = req.headers["sec-fetch-site"];
  if (fetchSite && fetchSite !== "same-origin") return false;

  // Origin is authoritative when the browser supplies it. Falling through to
  // a localhost Referer after seeing a foreign Origin would let the weaker
  // signal override the stronger one. Same-origin GETs commonly omit Origin,
  // which is the one case where Referer is the intended fallback.
  if (req.headers.origin) return expectedLocalUrl(req.headers.origin, expectedOrigin);
  return expectedLocalUrl(req.headers.referer, expectedOrigin);
}

function tokenMatches(supplied, expected) {
  if (typeof supplied !== "string") return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(body);
}

async function jsonBody(req, maxBody) {
  const mediaType = String(req.headers["content-type"] ?? "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (mediaType !== "application/json") {
    throw new DevEditorError(
      "The editor accepts JSON requests only.",
      415,
      "bad_content_type"
    );
  }

  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBody) {
      throw new DevEditorError("The editor request is too large.", 413, "too_large");
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new DevEditorError("The editor request is not valid JSON.", 400, "bad_json");
  }
}

/**
 * Build, but do not start, the localhost vault-editor sidecar.
 *
 * Keeping listen/process lifecycle out of this factory lets tests bind to an
 * ephemeral port and a temporary vault. The entry script remains the sole
 * owner of the real development process and its signal handlers.
 */
export function createDevEditorServer({
  repoRoot,
  expectedOrigin = "http://localhost:3000",
  sessionToken = randomBytes(32).toString("base64url"),
  maxBody = DEFAULT_MAX_BODY,
} = {}) {
  if (typeof repoRoot !== "string" || !repoRoot) {
    throw new TypeError("createDevEditorServer requires repoRoot");
  }
  let origin;
  try {
    origin = new URL(expectedOrigin);
  } catch {
    throw new TypeError("createDevEditorServer requires a valid expectedOrigin");
  }
  if (
    origin.origin !== expectedOrigin ||
    origin.hostname !== "localhost" ||
    (origin.protocol !== "http:" && origin.protocol !== "https:")
  ) {
    throw new TypeError("createDevEditorServer requires an exact localhost origin");
  }
  if (!Number.isSafeInteger(maxBody) || maxBody <= 0) {
    throw new TypeError("createDevEditorServer requires a positive maxBody");
  }

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      if (!sameOriginBrowser(req, expectedOrigin)) {
        throw new DevEditorError(
          "Only the localhost site may use the vault editor.",
          403,
          "bad_origin"
        );
      }

      if (req.method === "GET" && url.pathname === "/session") {
        send(res, 200, { token: sessionToken });
        return;
      }
      if (req.method !== "POST") {
        throw new DevEditorError(
          "That HTTP method is not supported by the vault editor.",
          405,
          "method_not_allowed"
        );
      }
      if (!tokenMatches(req.headers["x-vault-editor-token"], sessionToken)) {
        throw new DevEditorError(
          "The vault editor session is not authorized.",
          403,
          "unauthorized"
        );
      }

      const body = await jsonBody(req, maxBody);
      if (url.pathname === "/document") {
        send(res, 200, readDocument(repoRoot, body.source));
        return;
      }
      if (url.pathname === "/page-document") {
        send(res, 200, await readPageDocument(repoRoot, body.source, body.sourceUk));
        return;
      }
      if (url.pathname === "/save") {
        send(res, 200, await saveDocument(repoRoot, body));
        return;
      }
      if (url.pathname === "/save-page") {
        send(res, 200, await savePageDocument(repoRoot, body));
        return;
      }
      if (url.pathname === "/create-entry") {
        send(res, 201, await createEntry(repoRoot, body));
        return;
      }
      if (url.pathname === "/toggle-now-goal") {
        send(res, 200, await toggleNowGoal(repoRoot, body));
        return;
      }
      if (url.pathname === "/reorder") {
        send(res, 200, await reorderDocuments(repoRoot, body));
        return;
      }
      throw new DevEditorError("Unknown vault editor endpoint.", 404, "not_found");
    } catch (error) {
      const known = error instanceof DevEditorError;
      send(res, known ? error.status : 500, {
        code: known ? error.code : "internal_error",
        message: known ? error.message : "The local vault editor failed.",
      });
      if (!known) console.error(error);
    }
  });
}
