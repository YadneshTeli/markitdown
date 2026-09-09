/**
 * WikipediaConverter — extracts main content from Wikipedia pages.
 * TypeScript port of Python's `_wikipedia_converter.py`.
 */
import {
  DocumentConverter,
  DocumentConverterResult,
  type ConvertOptions,
} from "../base-converter.js";
import type { StreamInfo } from "../stream-info.js";
import { createMarkdownConverter } from "./markdownify.js";
import * as cheerio from "cheerio";

const ACCEPTED_MIME_TYPE_PREFIXES = ["text/html", "application/xhtml"];
const ACCEPTED_FILE_EXTENSIONS = [".html", ".htm"];

const WIKIPEDIA_URL_PATTERN = /^https?:\/\/[a-zA-Z]{2,3}\.wikipedia\.org\//;

export class WikipediaConverter extends DocumentConverter {
  accepts(
    _fileStream: Buffer,
    streamInfo: StreamInfo,
    _options?: ConvertOptions,
  ): boolean {
    const url = streamInfo.url || "";
    const mimetype = (streamInfo.mimetype || "").toLowerCase();
    const extension = (streamInfo.extension || "").toLowerCase();

    if (!WIKIPEDIA_URL_PATTERN.test(url)) {
      return false;
    }

    if (ACCEPTED_FILE_EXTENSIONS.includes(extension)) return true;

    for (const prefix of ACCEPTED_MIME_TYPE_PREFIXES) {
      if (mimetype.startsWith(prefix)) return true;
    }

    return false;
  }

  convert(
    fileStream: Buffer,
    streamInfo: StreamInfo,
    options?: ConvertOptions,
  ): DocumentConverterResult {
    const encoding = streamInfo.charset || "utf-8";
    const html = fileStream.toString(encoding as BufferEncoding);
    const $ = cheerio.load(html);

    // Remove script and style blocks
    $("script, style").remove();

    const turndown = createMarkdownConverter({
      keepDataUris: options?.keepDataUris || false,
    });

    // Get main content
    const bodyElm = $("#mw-content-text");
    const titleElm = $(".mw-page-title-main");

    let mainTitle = $("title").text()?.trim() || null;
    let webpageText = "";

    if (bodyElm.length > 0) {
      if (titleElm.length > 0) {
        mainTitle = titleElm.text()?.trim() || mainTitle;
      }

      const bodyHtml = bodyElm.html() || "";
      webpageText =
        (mainTitle ? `# ${mainTitle}\n\n` : "") + turndown.turndown(bodyHtml);
    } else {
      webpageText = turndown.turndown($.html() || "");
    }

    return new DocumentConverterResult({
      markdown: webpageText,
      title: mainTitle || undefined,
    });
  }
}
