/**
 * ZipConverter — converts ZIP files by extracting and converting contents.
 * TypeScript port of Python's `_zip_converter.py`.
 */
import {
  DocumentConverter,
  DocumentConverterResult,
  type ConvertOptions,
} from "../base-converter.js";
import type { StreamInfo } from "../stream-info.js";
import * as path from "node:path";
import JSZip from "jszip";

const ACCEPTED_MIME_TYPE_PREFIXES = ["application/zip"];
const ACCEPTED_FILE_EXTENSIONS = [".zip"];

/**
 * The ZipConverter needs a reference back to the MarkItDown engine
 * for recursive conversion of contained files.
 */
export interface MarkItDownLike {
  convertStream(
    stream: Buffer,
    options?: { streamInfo?: StreamInfo },
  ): Promise<DocumentConverterResult>;
}

export class ZipConverter extends DocumentConverter {
  private markitdown: MarkItDownLike;

  constructor(markitdown: MarkItDownLike) {
    super();
    this.markitdown = markitdown;
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
    _options?: ConvertOptions,
  ): Promise<DocumentConverterResult> {
    if (!JSZip) {
      throw new Error(
        "jszip is required for ZIP conversion. Install it with: npm install jszip",
      );
    }

    const filePath =
      streamInfo.url || streamInfo.localPath || streamInfo.filename || "(unknown)";

    let mdContent = `Content from the zip file \`${filePath}\`:\n\n`;

    const zip = await JSZip.loadAsync(fileStream);

    for (const [name, zipEntry] of Object.entries(zip.files)) {
      if (zipEntry.dir) continue;

      try {
        const content = await zipEntry.async("nodebuffer");
        const ext = path.extname(name);
        const filename = path.basename(name);

        const result = await this.markitdown.convertStream(Buffer.from(content), {
          streamInfo: {
            extension: ext,
            filename,
          },
        });

        if (result) {
          mdContent += `## File: ${name}\n\n`;
          mdContent += result.markdown + "\n\n";
        }
      } catch {
        // Skip files that fail to convert
      }
    }

    return new DocumentConverterResult({ markdown: mdContent.trim() });
  }
}
