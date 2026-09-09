/**
 * BingSerpConverter — extracts main content from Bing search result pages.
 * TypeScript port of Python's `_bing_serp_converter.py`.
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

export class BingSerpConverter extends DocumentConverter {
  accepts(
    _fileStream: Buffer,
    streamInfo: StreamInfo,
    _options?: ConvertOptions,
  ): boolean {
    const url = streamInfo.url || "";
    const mimetype = (streamInfo.mimetype || "").toLowerCase();
    const extension = (streamInfo.extension || "").toLowerCase();

    if (!/^https:\/\/www\.bing\.com\/search\?q=/.test(url)) {
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
    let query = "";
    if (streamInfo.url) {
      try {
        const parsedUrl = new URL(streamInfo.url);
        query = parsedUrl.searchParams.get("q") || "";
      } catch {
        // Fallback if URL cannot be parsed
      }
    }

    const encoding = streamInfo.charset || "utf-8";
    const html = fileStream.toString(encoding as BufferEncoding);
    const $ = cheerio.load(html);

    // Clean up formatting
    $(".tptt").each((_, el) => {
      $(el).append(" ");
    });
    $(".algoSlug_icon").remove();

    const turndown = createMarkdownConverter(options);
    const results: string[] = [];

    $(".b_algo").each((_, el) => {
      const $result = $(el);

      // Rewrite redirect URLs
      $result.find("a[href]").each((_, a) => {
        const href = $(a).attr("href") || "";
        try {
          const parsedHref = new URL(href, "https://www.bing.com");
          const u = parsedHref.searchParams.get("u");
          if (u && u.length > 2) {
            // Drop first 2 characters, base64url decode
            const b64 = u.slice(2).replace(/-/g, "+").replace(/_/g, "/");
            const decoded = Buffer.from(b64, "base64").toString("utf-8");
            if (decoded) {
              $(a).attr("href", decoded);
            }
          }
        } catch {
          // Ignore URL parsing errors
        }
      });

      const mdResult = turndown.turndown($result.html() || "").trim();
      const lines = mdResult
        .split(/\n+/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      if (lines.length > 0) {
        results.push(lines.join("\n"));
      }
    });

    const title = $("title").text().trim() || undefined;
    const webpageText = `## A Bing search for '${query}' found the following results:\n\n${results.join("\n\n")}`;

    return new DocumentConverterResult({
      markdown: webpageText,
      title,
    });
  }
}
