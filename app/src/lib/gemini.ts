const GEMINI_MODEL = "gemini-3.5-flash";
const GEMINI_MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_UPLOAD_URL = "https://generativelanguage.googleapis.com/upload/v1beta/files";
const GEMINI_GENERATE_URL = `${GEMINI_MODELS_URL}/${GEMINI_MODEL}:generateContent`;

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  return key;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function uploadVideo(
  videoBuffer: Buffer,
  mimeType: string
): Promise<{ uri: string; mimeType: string }> {
  const key = getApiKey();

  const response = await fetch(`${GEMINI_UPLOAD_URL}?key=${key}`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Command": "start, upload, finalize",
      "X-Goog-Upload-Header-Content-Length": String(videoBuffer.length),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": mimeType,
    },
    body: new Uint8Array(videoBuffer),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini upload error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const fileName = data.file.name; // e.g. "files/abc123"
  const fileUri = data.file.uri;
  const fileMimeType = data.file.mimeType;

  // Poll until file is ACTIVE (Gemini needs to process the upload)
  await waitForFileActive(fileName);

  return { uri: fileUri, mimeType: fileMimeType };
}

async function waitForFileActive(fileName: string, maxWaitMs = 120000): Promise<void> {
  const key = getApiKey();
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${key}`
    );

    if (!response.ok) {
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }

    const data = await response.json();
    const state = data.state;

    if (state === "ACTIVE") return;
    if (state === "FAILED") throw new Error(`Gemini file processing failed for ${fileName}`);

    // Still PROCESSING — wait and retry
    await new Promise((r) => setTimeout(r, 3000));
  }

  throw new Error(`Gemini file ${fileName} did not become ACTIVE within ${maxWaitMs / 1000}s`);
}

export async function analyzeVideo(
  fileUri: string,
  mimeType: string,
  analysisPrompt: string,
  maxRetries = 3
): Promise<string> {
  const key = getApiKey();

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(`${GEMINI_GENERATE_URL}?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { fileData: { fileUri, mimeType } },
                { text: analysisPrompt },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        if (attempt < maxRetries - 1) {
          await new Promise((r) => setTimeout(r, 5000));
          continue;
        }
        throw new Error(`Gemini analysis error ${response.status}: ${text}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      // Strip everything before first # (same as n8n workflow)
      const hashIndex = text.indexOf("#");
      return hashIndex >= 0 ? text.substring(hashIndex) : text;
    } catch (error) {
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      throw error;
    }
  }

  throw new Error("Gemini analysis failed after retries");
}

// ── Text generation (replaces the former Claude text calls) ──────────────────

// Single-shot text/JSON generation against gemini-3.5-flash. `json: true` asks
// the model for raw JSON (no code fences) via responseMimeType — callers still
// brace-extract for safety.
export async function generateText(opts: {
  prompt: string;
  system?: string;
  maxOutputTokens?: number;
  json?: boolean;
  maxRetries?: number;
}): Promise<string> {
  const key = getApiKey();
  const { prompt, system, maxOutputTokens = 4096, json = false, maxRetries = 3 } = opts;

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens,
      ...(json ? { responseMimeType: "application/json" } : {}),
    },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(`${GEMINI_GENERATE_URL}?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();
        if (attempt < maxRetries - 1) {
          await sleep(4000);
          continue;
        }
        throw new Error(`Gemini generate error ${response.status}: ${text}`);
      }

      const data = await response.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      return parts.map((p: { text?: string }) => p.text || "").join("");
    } catch (error) {
      if (attempt < maxRetries - 1) {
        await sleep(4000);
        continue;
      }
      throw error;
    }
  }

  throw new Error("Gemini generate failed after retries");
}

// ── Streaming + function calling (powers the chat assistant loop) ─────────────

export interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

export interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

// Gemini function declaration. `parameters` is an OpenAPI-subset schema whose
// `type` values are UPPERCASE ("OBJECT", "STRING", ...).
export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface GeminiFunctionCall {
  name: string;
  args: Record<string, unknown>;
}

// Stream one model turn: forward text deltas through onText, collect any
// function calls, and return both. The caller runs the tool loop.
export async function streamGeminiTurn(opts: {
  contents: GeminiContent[];
  system?: string;
  tools?: GeminiFunctionDeclaration[];
  maxOutputTokens?: number;
  onText: (delta: string) => void;
}): Promise<{ text: string; functionCalls: GeminiFunctionCall[] }> {
  const key = getApiKey();
  const { contents, system, tools, maxOutputTokens = 8192, onText } = opts;

  const body: Record<string, unknown> = {
    contents,
    generationConfig: { maxOutputTokens },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  if (tools && tools.length) body.tools = [{ functionDeclarations: tools }];

  const response = await fetch(
    `${GEMINI_MODELS_URL}/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    throw new Error(`Gemini stream error ${response.status}: ${text}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  const functionCalls: GeminiFunctionCall[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      let chunk: { candidates?: { content?: { parts?: GeminiPart[] } }[] };
      try {
        chunk = JSON.parse(payload);
      } catch {
        continue;
      }
      const parts = chunk.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (typeof part.text === "string" && part.text) {
          text += part.text;
          onText(part.text);
        }
        if (part.functionCall) {
          functionCalls.push({
            name: part.functionCall.name,
            args: part.functionCall.args || {},
          });
        }
      }
    }
  }

  return { text, functionCalls };
}
