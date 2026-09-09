/**
 * DocxConverter — converts DOCX files to Markdown.
 * TypeScript port of Python's `_docx_converter.py`.
 * Uses `mammoth` (same library — it has a native JS version!).
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
import { HtmlConverter } from "./html.js";

const ACCEPTED_MIME_TYPE_PREFIXES = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const ACCEPTED_FILE_EXTENSIONS = [".docx"];

import mammoth from "mammoth";

export class DocxConverter extends DocumentConverter {
  private htmlConverter = new HtmlConverter();

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
    options?: ConvertOptions,
  ): Promise<DocumentConverterResult> {
    if (!mammoth) {
      throw new MissingDependencyError(
        buildMissingDependencyMessage("DocxConverter", ".docx", "mammoth"),
      );
    }

    const styleMap = options?.styleMap
      ? `${options.styleMap}\nu => u`
      : "u => u";

    const result = await mammoth.convertToHtml(
      { buffer: fileStream },
      {
        styleMap,
        includeEmbeddedStyleMap: false,
      },
    );

    return this.htmlConverter.convertString(result.value, options);
  }
}
