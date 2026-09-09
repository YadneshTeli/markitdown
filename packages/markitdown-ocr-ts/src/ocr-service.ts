import type { StreamInfo } from "markitdown";
import type { OCRResult, OCRService } from "./types.js";

/**
 * Tesseract.js OCR Service — Runs pure JavaScript / WebAssembly OCR locally.
 * Zero external cloud API calls or binary installations needed.
 */
export class TesseractOCRService implements OCRService {
  private lang: string;
  private workerPromise?: Promise<any>;

  constructor(lang = "eng") {
    this.lang = lang;
  }

  private async getWorker() {
    if (!this.workerPromise) {
      this.workerPromise = (async () => {
        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker(this.lang);
        return worker;
      })();
    }
    return this.workerPromise;
  }

  async extractText(
    imageStream: Buffer,
    _prompt?: string,
    _streamInfo?: StreamInfo,
  ): Promise<OCRResult> {
    try {
      const worker = await this.getWorker();
      const result = await worker.recognize(imageStream);
      return {
        text: (result.data.text || "").trim(),
        confidence: result.data.confidence,
        backendUsed: "tesseract",
      };
    } catch (err) {
      return {
        text: "",
        backendUsed: "tesseract",
        error: String(err),
      };
    }
  }

  async terminate(): Promise<void> {
    if (this.workerPromise) {
      const worker = await this.workerPromise;
      await worker.terminate();
      this.workerPromise = undefined;
    }
  }
}

/**
 * LLM Vision OCR Service — Matches Python MarkItDown OCR.
 * Uses OpenAI-compatible or multimodal API to extract text from images.
 */
export class LLMVisionOCRService implements OCRService {
  private client: any;
  private model: string;
  private defaultPrompt: string;

  constructor(
    client: any,
    model = "gpt-4o",
    defaultPrompt?: string,
  ) {
    this.client = client;
    this.model = model;
    this.defaultPrompt =
      defaultPrompt ||
      "Extract all text from this image. Return ONLY the extracted text, maintaining the original layout and order. Do not add any commentary or description.";
  }

  async extractText(
    imageStream: Buffer,
    prompt?: string,
    streamInfo?: StreamInfo,
  ): Promise<OCRResult> {
    if (!this.client) {
      return {
        text: "",
        backendUsed: "llm_vision",
        error: "LLM client not configured",
      };
    }

    try {
      const mime = streamInfo?.mimetype || "image/png";
      const base64 = imageStream.toString("base64");
      const dataUri = `data:${mime};base64,${base64}`;

      const actualPrompt = prompt || this.defaultPrompt;
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: actualPrompt },
              {
                type: "image_url",
                image_url: { url: dataUri },
              },
            ],
          },
        ],
      });

      const text = response.choices?.[0]?.message?.content || "";
      return {
        text: text.trim(),
        backendUsed: "llm_vision",
      };
    } catch (err) {
      return {
        text: "",
        backendUsed: "llm_vision",
        error: String(err),
      };
    }
  }
}
