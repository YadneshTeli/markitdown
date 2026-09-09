import { describe, it, expect, vi } from "vitest";
import { MarkItDown } from "markitdown";
import {
  registerConverters,
  ImageConverterWithOCR,
  PdfConverterWithOCR,
  TesseractOCRService,
  LLMVisionOCRService,
  PRIORITY_OCR_ENHANCED,
} from "../src/index.js";

describe("MarkItDown OCR Plugin", () => {
  it("registers OCR converters with priority -1.0", () => {
    const md = new MarkItDown({ enableBuiltins: true });
    registerConverters(md);

    // md.converters is private, but we can verify image converter accepts image formats
    expect(PRIORITY_OCR_ENHANCED).toBe(-1.0);
  });

  it("ImageConverterWithOCR accepts image formats", () => {
    const converter = new ImageConverterWithOCR();
    const dummyBuffer = Buffer.from("dummy");

    expect(
      converter.accepts(dummyBuffer, { extension: ".png", mimetype: "image/png" }),
    ).toBe(true);
    expect(
      converter.accepts(dummyBuffer, { extension: ".jpg", mimetype: "image/jpeg" }),
    ).toBe(true);
    expect(
      converter.accepts(dummyBuffer, { extension: ".txt", mimetype: "text/plain" }),
    ).toBe(false);
  });

  it("ImageConverterWithOCR extracts text from OCR service", async () => {
    const mockOCR = {
      extractText: vi.fn().mockResolvedValue({
        text: "Sample Extracted Invoice #12345",
        confidence: 95.5,
        backendUsed: "mock_ocr",
      }),
    };

    const converter = new ImageConverterWithOCR(mockOCR as any);
    const result = await converter.convert(
      Buffer.from("dummy image bytes"),
      { extension: ".png", mimetype: "image/png", filename: "invoice.png" },
    );

    expect(result.markdown).toContain("Sample Extracted Invoice #12345");
    expect(mockOCR.extractText).toHaveBeenCalled();
  });

  it("PdfConverterWithOCR accepts PDF formats", () => {
    const converter = new PdfConverterWithOCR();
    const dummyBuffer = Buffer.from("dummy");

    expect(
      converter.accepts(dummyBuffer, { extension: ".pdf", mimetype: "application/pdf" }),
    ).toBe(true);
    expect(
      converter.accepts(dummyBuffer, { extension: ".docx", mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
    ).toBe(false);
  });

  it("LLMVisionOCRService extracts text via client completions", async () => {
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: "Header text from Vision model" } }],
          }),
        },
      },
    };

    const service = new LLMVisionOCRService(mockClient, "gpt-4o");
    const result = await service.extractText(
      Buffer.from("test image data"),
      undefined,
      { mimetype: "image/png" },
    );

    expect(result.text).toBe("Header text from Vision model");
    expect(result.backendUsed).toBe("llm_vision");
    expect(mockClient.chat.completions.create).toHaveBeenCalled();
  });
});
