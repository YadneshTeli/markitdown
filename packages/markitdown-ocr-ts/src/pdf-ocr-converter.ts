import {
  DocumentConverter,
  DocumentConverterResult,
  type ConvertOptions,
  type StreamInfo,
} from "markitdown";
import type { OCRService } from "./types.js";
import { TesseractOCRService } from "./ocr-service.js";

const ACCEPTED_MIME_TYPE_PREFIXES = ["application/pdf", "application/x-pdf"];
const ACCEPTED_FILE_EXTENSIONS = [".pdf"];

export class PdfConverterWithOCR extends DocumentConverter {
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

    if (ACCEPTED_FILE_EXTENSIONS.includes(extension)) return true;

    for (const prefix of ACCEPTED_MIME_TYPE_PREFIXES) {
      if (mimetype.startsWith(prefix)) return true;
    }

    return false;
  }

  async convert(
    fileStream: Buffer,
    streamInfo: StreamInfo,
    options?: ConvertOptions,
  ): Promise<DocumentConverterResult> {
    let text = "";
    let title: string | undefined;

    try {
      const pdfModule = "pdf-parse";
      const pdfParseModule: any = await import(pdfModule);
      const pdfParse = pdfParseModule.default || pdfParseModule;
      const data = await pdfParse(fileStream);
      text = data.text || "";
      title = data.info?.Title;
    } catch {
      // PDF parse failed or scanned image PDF
    }

    // If PDF text is sparse or empty, run OCR extraction
    if (text.trim().length < 50) {
      try {
        const ocrRes = await this.ocrService.extractText(
          fileStream,
          options?.llmPrompt,
          streamInfo,
        );
        if (ocrRes.text && ocrRes.text.trim()) {
          text = ocrRes.text.trim();
        }
      } catch {
        // Fall back to original text
      }
    }

    text = text.replace(/\r\n/g, "\n").trim();

    return new DocumentConverterResult({
      title,
      markdown: text,
    });
  }
}
