/**
 * LLM Image Captioning — generates descriptive captions for images via multimodal LLMs.
 * TypeScript port of Python's `_llm_caption.py`.
 */
import type { StreamInfo } from "./stream-info.js";

export interface LlmCaptionOptions {
  client: any;
  model?: string;
  prompt?: string;
}

/**
 * Generate a descriptive caption for an image using an LLM.
 * Supports:
 * 1. OpenAI-style client (`client.chat.completions.create({ model, messages })`)
 * 2. Custom async function `(buffer, mimetype, prompt) => Promise<string>`
 */
export async function llmCaption(
  fileStream: Buffer,
  streamInfo: StreamInfo,
  options: LlmCaptionOptions,
): Promise<string | null> {
  const prompt =
    options.prompt && options.prompt.trim() !== ""
      ? options.prompt
      : "Write a detailed caption for this image.";

  const mimetype = streamInfo.mimetype || "image/jpeg";

  // If client is a custom function:
  if (typeof options.client === "function") {
    try {
      const res = await options.client(fileStream, mimetype, prompt);
      return typeof res === "string" ? res.trim() : null;
    } catch {
      return null;
    }
  }

  // If client has custom caption method:
  if (typeof options.client?.caption === "function") {
    try {
      const res = await options.client.caption(fileStream, mimetype, prompt);
      return typeof res === "string" ? res.trim() : null;
    } catch {
      return null;
    }
  }

  // Standard OpenAI-compatible API
  if (options.client?.chat?.completions?.create) {
    try {
      const base64Image = fileStream.toString("base64");
      const dataUri = `data:${mimetype};base64,${base64Image}`;

      const model = options.model || "gpt-4o";
      const messages = [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: dataUri,
              },
            },
          ],
        },
      ];

      const response = await options.client.chat.completions.create({
        model,
        messages,
      });

      const text = response.choices?.[0]?.message?.content;
      return typeof text === "string" ? text.trim() : null;
    } catch {
      return null;
    }
  }

  return null;
}
