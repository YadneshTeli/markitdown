/**
 * HtmlConverter — converts HTML to Markdown.
 * TypeScript port of Python's `_html_converter.py`.
 */
import {
  DocumentConverter,
  DocumentConverterResult,
  type ConvertOptions,
} from "../base-converter.js";
import type { StreamInfo } from "../stream-info.js";
import { createMarkdownConverter } from "./markdownify.js";
import * as cheerio from "cheerio";
import iconv from "iconv-lite";

const ACCEPTED_MIME_TYPE_PREFIXES = ["text/html", "application/xhtml"];

const ACCEPTED_FILE_EXTENSIONS = [".html", ".htm"];

export class HtmlConverter extends DocumentConverter {
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

  convert(
    fileStream: Buffer,
    streamInfo: StreamInfo,
    options?: ConvertOptions,
  ): DocumentConverterResult {
    const encoding = streamInfo.charset || "utf-8";
    let htmlString: string;
    try {
      htmlString = iconv.decode(fileStream, encoding);
    } catch {
      htmlString = fileStream.toString(encoding as BufferEncoding);
    }

    return this.convertString(htmlString, options);
  }

  /**
   * Convenience method to convert an HTML string to Markdown.
   * Used by other converters that produce HTML as intermediate output.
   */
  convertString(
    htmlContent: string,
    options?: ConvertOptions,
  ): DocumentConverterResult {
    const $ = cheerio.load(htmlContent);

    // Remove script and style blocks
    $("script, style").remove();

    // Extract title
    const title = $("title").text() || undefined;

    // Get body content, or full document if no body
    const body = $("body");
    const targetHtml = body.length > 0 ? body.html() || "" : $.html() || "";

    // Convert to Markdown using Turndown
    const turndown = createMarkdownConverter({
      keepDataUris: options?.keepDataUris || false,
    });
    let markdown = turndown.turndown(targetHtml);

    // Clean up leading/trailing whitespace
    markdown = markdown.trim();

    return new DocumentConverterResult({
      markdown,
      title: title?.trim() || undefined,
    });
  }
}
