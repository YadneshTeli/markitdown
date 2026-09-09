/**
 * Sample MarkItDown Plugin — RTF Converter
 *
 * TypeScript port of Python's `markitdown-sample-plugin`.
 * Demonstrates the plugin interface by providing a simple RTF → Markdown converter.
 *
 * Plugin Discovery:
 * This package has "markitdown-plugin" in its keywords in package.json.
 * It exports a `registerConverters` function that MarkItDown will call
 * during initialization when plugins are enabled.
 */
import {
  DocumentConverter,
  DocumentConverterResult,
  type ConvertOptions,
  type StreamInfo,
} from "markitdown";
import type { MarkItDown } from "markitdown";

/** Plugin interface version */
export const PLUGIN_INTERFACE_VERSION = 1;

const ACCEPTED_MIME_TYPE_PREFIXES = ["text/rtf", "application/rtf"];
const ACCEPTED_FILE_EXTENSIONS = [".rtf"];

/**
 * Called by MarkItDown during construction to register this plugin's converters.
 */
export function registerConverters(markitdown: MarkItDown): void {
  markitdown.registerConverter(new RtfConverter());
}

/**
 * Converts RTF files to plain text (simple strip approach).
 *
 * Note: A full RTF parser would require a dependency like `rtf-parser`.
 * This sample implementation strips basic RTF control words.
 */
export class RtfConverter extends DocumentConverter {
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

  convert(
    fileStream: Buffer,
    streamInfo: StreamInfo,
    _options?: ConvertOptions,
  ): DocumentConverterResult {
    const encoding = streamInfo.charset || "utf-8";
    const rtfContent = fileStream.toString(encoding as BufferEncoding);

    // Simple RTF stripping — remove control words and braces
    let text = rtfContent;

    // Remove RTF header
    text = text.replace(/^\{\\rtf1[^}]*\}?/, "");

    // Remove control words (e.g., \par, \b, \i, \f0, \fs24)
    text = text.replace(/\\[a-z]+\d*\s?/gi, "");

    // Remove escaped characters
    text = text.replace(/\\\\/g, "\\");
    text = text.replace(/\\{/g, "{");
    text = text.replace(/\\}/g, "}");

    // Remove remaining braces
    text = text.replace(/[{}]/g, "");

    // Replace \par with newlines
    text = text.replace(/\\par\s*/g, "\n");

    // Clean up whitespace
    text = text.replace(/\r\n/g, "\n");
    text = text.replace(/\n{3,}/g, "\n\n");
    text = text.trim();

    return new DocumentConverterResult({
      title: undefined,
      markdown: text,
    });
  }
}
