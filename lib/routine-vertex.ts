import { getVercelOidcToken } from "@vercel/oidc";
import { ExternalAccountClient } from "google-auth-library";
import { replyAnswer, RESPONSE_SCHEMA } from "@/lib/routine-gemini";

/**
 * Calling Gemini on Vertex AI, imported only by `app/api/routine/`. No key exists
 * to leak: Vercel proves which deployment is asking, Google trades that for a
 * short-lived token, and only Production is trusted (docs/ROUTINE.md).
 *
 * Vertex rather than the Gemini API because the trial credit can't pay for
 * AI Studio, and because API traffic on the free tier may be used for training.
 */

const MODEL = process.env.ROUTINE_GEMINI_MODEL ?? "gemini-3.1-flash-lite";

/**
 * Thinking counts against this, and a real note hit 2048 with only 2153
 * characters of answer. 30 changes, the most a note may hold, fit well inside
 * this, so it stops a runaway reply without cutting off a real one.
 */
const MAX_OUTPUT_TOKENS = 8192;
const TIMEOUT_MS = 25_000;

interface Settings {
  projectId: string;
  projectNumber: string;
  serviceAccount: string;
  pool: string;
  provider: string;
}

function settings(): Settings | null {
  const {
    GCP_PROJECT_ID: projectId,
    GCP_PROJECT_NUMBER: projectNumber,
    GCP_SERVICE_ACCOUNT_EMAIL: serviceAccount,
    GCP_WORKLOAD_IDENTITY_POOL_ID: pool,
    GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID: provider,
  } = process.env;
  if (!projectId || !projectNumber || !serviceAccount || !pool || !provider) return null;
  return { projectId, projectNumber, serviceAccount, pool, provider };
}

export function geminiConnected(): boolean {
  return settings() !== null;
}

async function accessToken({ projectNumber, pool, provider, serviceAccount }: Settings) {
  const audience = `//iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${pool}/providers/${provider}`;
  const client = ExternalAccountClient.fromJSON({
    type: "external_account",
    audience,
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    token_url: "https://sts.googleapis.com/v1/token",
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccount}:generateAccessToken`,
    subject_token_supplier: { getSubjectToken: () => getVercelOidcToken() },
  });
  const { token } = (await client?.getAccessToken()) ?? {};
  if (!token) throw new Error("no_token");
  return token;
}

export async function askGemini(system: string, user: string, schema: object = RESPONSE_SCHEMA) {
  const config = settings();
  if (!config) throw new Error("not_connected");

  const url = `https://aiplatform.googleapis.com/v1/projects/${config.projectId}/locations/global/publishers/google/models/${MODEL}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await accessToken(config)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        temperature: 0.2,
        // MINIMAL dropped the 7pm from a note saying "11am-7pm".
        thinkingConfig: { thinkingLevel: "LOW" },
      },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`vertex_${response.status}`);

  const body = await response.json();
  return {
    answer: replyAnswer(body, (reason) => console.error("routine: Gemini reply:", reason)),
    inputTokens: (body.usageMetadata?.promptTokenCount ?? 0) as number,
    // Thinking is billed as output, so the daily record has to include it.
    outputTokens: ((body.usageMetadata?.candidatesTokenCount ?? 0) +
      (body.usageMetadata?.thoughtsTokenCount ?? 0)) as number,
  };
}
