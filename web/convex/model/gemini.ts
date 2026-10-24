import type { Part } from "./llm";

// GEMINI_MODEL overrides the model per deployment without a code change.
export const geminiModel = () => process.env.GEMINI_MODEL ?? "gemini-3.8-flash";

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
};

const toPart = (part: Part) =>
  part.type === "text" ? { text: part.text } : { inlineData: { mimeType: part.mimeType, data: part.data } };

// Plain fetch to the REST API, so it runs in Convex's default runtime without an SDK.
export async function askGemini(system: string, parts: Part[], schema: Record<string, unknown>): Promise<unknown> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set on this Convex deployment.");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel()}:generateContent`;
  const request = {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: parts.map(toPart) }],
      generationConfig: { maxOutputTokens: 16000, responseMimeType: "application/json", responseJsonSchema: schema },
    }),
  };
  // Gemini answers 503 "high demand" in bursts; retry overload and rate-limit errors with backoff.
  let res = await fetch(url, request);
  for (let attempt = 1; attempt <= 3 && (res.status === 429 || res.status >= 500); attempt++) {
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
    res = await fetch(url, request);
  }
  const body = (await res.json()) as GeminiResponse;
  if (!res.ok) throw new Error(`Gemini API error ${res.status}: ${body.error?.message ?? res.statusText}`);
  if (body.promptFeedback?.blockReason) throw new Error("The model declined to read this file.");
  const candidate = body.candidates?.[0];
  if (candidate?.finishReason === "MAX_TOKENS") throw new Error("The model's answer was cut off (max_tokens).");
  if (candidate?.finishReason && candidate.finishReason !== "STOP") throw new Error("The model declined to read this file.");
  const text = candidate?.content?.parts?.find((p) => p.text && !p.thought)?.text;
  if (!text) throw new Error("The model returned no JSON.");
  return JSON.parse(text);
}
