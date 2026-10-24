import Anthropic from "@anthropic-ai/sdk";
import type { Part } from "./llm";

// RECEIPT_MODEL overrides the model per deployment without a code change.
export const receiptModel = () => process.env.RECEIPT_MODEL ?? "claude-sonnet-5-5";

function anthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set on this Convex deployment.");
  return new Anthropic();
}

type ImageType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

function toBlock(part: Part): Anthropic.Beta.BetaContentBlockParam {
  if (part.type === "text") return part;
  if (part.mimeType === "application/pdf") {
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data: part.data } };
  }
  return { type: "image", source: { type: "base64", media_type: part.mimeType as ImageType, data: part.data } };
}

// Structured output instead of a forced tool call: Sonnet 5.5 rejects forced tool_choice.
export async function askClaude(system: string, parts: Part[], schema: Record<string, unknown>): Promise<unknown> {
  const response = await anthropicClient().beta.messages.create({
    model: receiptModel(),
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: parts.map(toBlock) }],
    output_config: { format: { type: "json_schema", schema } },
  });
  if (response.stop_reason === "refusal") throw new Error("The model declined to read this file.");
  if (response.stop_reason === "max_tokens") throw new Error("The model's answer was cut off (max_tokens).");
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("The model returned no JSON.");
  return JSON.parse(text.text);
}
