/** Browser client for the loopback-only vault editor. Imported by dev-only islands. */

let sessionToken: string | null = null;

export class DevEditorRequestError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "DevEditorRequestError";
    this.code = code;
  }
}

async function token(fresh = false) {
  if (!fresh && sessionToken) return sessionToken;
  const response = await fetch("/__vault-editor/session", {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) throw new DevEditorRequestError("Editor session unavailable");
  const payload = (await response.json()) as { token?: string };
  if (!payload.token) throw new DevEditorRequestError("Editor session unavailable");
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
    if (!response.ok) {
      throw new DevEditorRequestError(payload.message ?? "Editor request failed", payload.code);
    }
    return payload as T;
  }
  throw new DevEditorRequestError("Editor session unavailable");
}
