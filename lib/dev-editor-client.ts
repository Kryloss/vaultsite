/** Browser client for the loopback-only vault editor. Imported by dev-only islands. */

import { EDITOR_PROTOCOL } from "@/lib/dev-tools";

let sessionToken: string | null = null;

export class DevEditorRequestError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "DevEditorRequestError";
    this.code = code;
  }
}

/**
 * An older sidecar answers with an older protocol number (or none), and an
 * endpoint it never heard of with 404. Both are the same situation with the
 * same fix, so both surface as one code the islands can name.
 */
export const SIDECAR_OUTDATED = "sidecar_outdated";

async function token(fresh = false) {
  if (!fresh && sessionToken) return sessionToken;
  const response = await fetch("/__vault-editor/session", {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) throw new DevEditorRequestError("Editor session unavailable");
  const payload = (await response.json()) as { token?: string; protocol?: number };
  if (!payload.token) throw new DevEditorRequestError("Editor session unavailable");
  if (payload.protocol !== EDITOR_PROTOCOL) {
    throw new DevEditorRequestError("The editor sidecar is out of date", SIDECAR_OUTDATED);
  }
  sessionToken = payload.token;
  return sessionToken;
}

export async function devEditorRequest<T>(endpoint: string, body: object): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const currentToken = await token(attempt > 0);
    const response = await fetch(`/__vault-editor/${endpoint}`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-Vault-Editor-Token": currentToken,
      },
      body: JSON.stringify(body),
    });
    if (response.status === 403 && attempt === 0) {
      sessionToken = null;
      continue;
    }
    const payload = (await response.json().catch(() => ({}))) as {
      code?: string;
      message?: string;
    };
    if (response.status === 404 && payload.code === "not_found") {
      throw new DevEditorRequestError("The editor sidecar is out of date", SIDECAR_OUTDATED);
    }
    if (!response.ok) {
      throw new DevEditorRequestError(payload.message ?? "Editor request failed", payload.code);
    }
    return payload as T;
  }
  throw new DevEditorRequestError("Editor session unavailable");
}

/** A pasted or dropped file as the base64 payload `/attach-asset` takes. */
export function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the file"));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}
