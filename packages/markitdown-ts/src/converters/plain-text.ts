/**
 * PlainTextConverter — handles text/* content.
 * TypeScript port of Python's `_plain_text_converter.py`.
 */
import {
  DocumentConverter,
  DocumentConverterResult,
  type ConvertOptions,
} from "../base-converter.js";
import type { StreamInfo } from "../stream-info.js";
import iconv from "iconv-lite";

const ACCEPTED_MIME_TYPE_PREFIXES = [
  "text/",
  "application/json",
  "application/markdown",
];

const ACCEPTED_FILE_EXTENSIONS = [
  ".txt",
  ".text",
  ".md",
  ".markdown",
  ".json",
  ".jsonl",
];

export class PlainTextConverter extends DocumentConverter {
  accepts(
    _fileStream: Buffer,
    streamInfo: StreamInfo,
    _options?: ConvertOptions,
  ): boolean {
    const mimetype = (streamInfo.mimetype || "").toLowerCase();
    const extension = (streamInfo.extension || "").toLowerCase();

    // If we have a charset, we can safely assume it's text
    if (streamInfo.charset) {
      return true;
    }

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

  convert(
    fileStream: Buffer,
    streamInfo: StreamInfo,
    _options?: ConvertOptions,
  ): DocumentConverterResult {
    let textContent: string;

    if (streamInfo.charset) {
      try {
        textContent = iconv.decode(fileStream, streamInfo.charset);
      } catch {
        textContent = fileStream.toString(streamInfo.charset as BufferEncoding);
      }
    } else {
      // Default to UTF-8
      textContent = fileStream.toString("utf-8");
    }

    return new DocumentConverterResult({ markdown: textContent });
  }
}
