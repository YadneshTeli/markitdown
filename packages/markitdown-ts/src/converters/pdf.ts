/**
 * PdfConverter — converts PDF files to Markdown.
 * TypeScript port of Python's `_pdf_converter.py`.
 * Uses `pdf-parse` (pdfjs-dist) for text extraction.
 */
import {
  DocumentConverter,
  DocumentConverterResult,
  type ConvertOptions,
} from "../base-converter.js";
import type { StreamInfo } from "../stream-info.js";
import {
  MissingDependencyError,
  buildMissingDependencyMessage,
} from "../exceptions.js";

const ACCEPTED_MIME_TYPE_PREFIXES = ["application/pdf", "application/x-pdf"];
const ACCEPTED_FILE_EXTENSIONS = [".pdf"];

import pdfParse from "pdf-parse";

export class PdfConverter extends DocumentConverter {
  accepts(
    _fileStream: Buffer,
    streamInfo: StreamInfo,
    _options?: ConvertOptions,
  ): boolean {
    const mimetype = (streamInfo.mimetype || "").toLowerCase();
    const extension = (streamInfo.extension || "").toLowerCase();

    if (ACCEPTED_FILE_EXTENSIONS.includes(extension)) {
      return true;
    }

    for (const prefix of ACCEPTED_MIME_TYPE_PREFIXES) {
      if (mimetype.startsWith(prefix)) {
        return true;
      }
    }

    return false;
  }

  async convert(
    fileStream: Buffer,
    _streamInfo: StreamInfo,
    _options?: ConvertOptions,
  ): Promise<DocumentConverterResult> {
    if (!pdfParse) {
      throw new MissingDependencyError(
        buildMissingDependencyMessage("PdfConverter", ".pdf", "pdf-parse"),
      );
    }

    const data = await pdfParse(fileStream);
    let markdown = data.text || "";

    // Post-process: merge MasterFormat-style partial numbering
    markdown = mergePartialNumberingLines(markdown);

    return new DocumentConverterResult({ markdown });
  }
}

/**
 * Post-process extracted text to merge MasterFormat-style partial numbering
 * (e.g., ".1\nThe intent...") with the following text line.
 */
function mergePartialNumberingLines(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  let i = 0;

  const PARTIAL_PATTERN = /^\.\d+$/;

  while (i < lines.length) {
    const stripped = lines[i].trim();

    if (PARTIAL_PATTERN.test(stripped)) {
      // Find next non-empty line
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) {
        j++;
      }
      if (j < lines.length) {
        result.push(`${stripped} ${lines[j].trim()}`);
        i = j + 1;
      } else {
        result.push(lines[i]);
        i++;
      }
    } else {
      result.push(lines[i]);
      i++;
    }
  }

  return result.join("\n");
}
