import {
  DocumentConverter,
  DocumentConverterResult,
  type ConvertOptions,
  type StreamInfo,
} from "markitdown";
import type { OCRService } from "./types.js";
import { TesseractOCRService } from "./ocr-service.js";

const ACCEPTED_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".tiff",
  ".tif",
  ".bmp",
  ".webp",
];

const ACCEPTED_MIME_PREFIXES = ["image/"];

export class ImageConverterWithOCR extends DocumentConverter {
  private ocrService: OCRService;

  constructor(ocrService?: OCRService) {
    super();
    this.ocrService = ocrService || new TesseractOCRService();
  }

  accepts(
    _fileStream: Buffer,
    streamInfo: StreamInfo,
    _options?: ConvertOptions,
  ): boolean {
    const mimetype = (streamInfo.mimetype || "").toLowerCase();
    const extension = (streamInfo.extension || "").toLowerCase();

    if (ACCEPTED_EXTENSIONS.includes(extension)) return true;

    for (const prefix of ACCEPTED_MIME_PREFIXES) {
      if (mimetype.startsWith(prefix) && !mimetype.includes("svg")) {
        return true;
      }
    }

    return false;
  }

  async convert(
    fileStream: Buffer,
    streamInfo: StreamInfo,
    options?: ConvertOptions,
  ): Promise<DocumentConverterResult> {
    let mdContent = "";

    // 1. Run OCR extraction
    try {
      const ocrResult = await this.ocrService.extractText(
        fileStream,
        options?.llmPrompt,
        streamInfo,
      );

      if (ocrResult.text && ocrResult.text.trim()) {
        mdContent += ocrResult.text.trim() + "\n\n";
      }
    } catch {
      // OCR failed or skipped
    }

    return new DocumentConverterResult({
      title: streamInfo.filename,
      markdown: mdContent.trim(),
    });
  }
}
