/**
 * MarkItDown OCR Plugin for TypeScript.
 * Provides OCR-enhanced converters for images and PDFs using Tesseract.js and LLM Vision.
 *
 * @packageDocumentation
 */
import type { MarkItDown } from "markitdown";
import type { OCRService } from "./types.js";
import { TesseractOCRService, LLMVisionOCRService } from "./ocr-service.js";
import { ImageConverterWithOCR } from "./image-ocr-converter.js";
import { PdfConverterWithOCR } from "./pdf-ocr-converter.js";

export * from "./types.js";
export * from "./ocr-service.js";
export * from "./image-ocr-converter.js";
export * from "./pdf-ocr-converter.js";

/** Plugin interface version */
export const PLUGIN_INTERFACE_VERSION = 1;

/** Higher priority than built-ins (0.0) so OCR converters are evaluated first */
export const PRIORITY_OCR_ENHANCED = -1.0;

/**
 * Called by MarkItDown during construction or plugin activation.
 */
export function registerConverters(
  markitdown: MarkItDown,
  options?: Record<string, unknown>,
): void {
  const llmClient = options?.llmClient;
  const llmModel = (options?.llmModel as string) || "gpt-4o";
  const llmPrompt = options?.llmPrompt as string | undefined;

  let ocrService: OCRService;
  if (llmClient) {
    ocrService = new LLMVisionOCRService(llmClient, llmModel, llmPrompt);
  } else {
    ocrService = new TesseractOCRService();
  }

  markitdown.registerConverter(
    new ImageConverterWithOCR(ocrService),
    PRIORITY_OCR_ENHANCED,
  );

  markitdown.registerConverter(
    new PdfConverterWithOCR(ocrService),
    PRIORITY_OCR_ENHANCED,
  );
}

export default {
  PLUGIN_INTERFACE_VERSION,
  registerConverters,
};
