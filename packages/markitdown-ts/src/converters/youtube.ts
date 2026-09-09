/**
 * YouTubeConverter — extracts YouTube video metadata and transcripts.
 * TypeScript port of Python's `_youtube_converter.py`.
 */
import {
  DocumentConverter,
  DocumentConverterResult,
  type ConvertOptions,
} from "../base-converter.js";
import type { StreamInfo } from "../stream-info.js";
import * as cheerio from "cheerio";

const ACCEPTED_MIME_TYPE_PREFIXES = ["text/html", "application/xhtml"];
const ACCEPTED_FILE_EXTENSIONS = [".html", ".htm"];

export class YouTubeConverter extends DocumentConverter {
  /**
   * Extract a YouTube video ID from supported URL formats.
   */
  private getVideoId(url: string): string | null {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();

      if (hostname === "youtu.be" || hostname === "www.youtu.be") {
        return parsed.pathname.split("/").filter(Boolean)[0] || null;
      }

      if (
        ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(hostname)
      ) {
        const pathParts = parsed.pathname.split("/").filter(Boolean);

        if (pathParts[0] === "watch") {
          return parsed.searchParams.get("v") || null;
        }
        if (pathParts[0] === "shorts" || pathParts[0] === "embed") {
          return pathParts[1] || null;
        }
      }
    } catch {
      // Not a valid URL
    }
    return null;
  }

  accepts(
    _fileStream: Buffer,
    streamInfo: StreamInfo,
    _options?: ConvertOptions,
  ): boolean {
    const url = streamInfo.url || "";
    const mimetype = (streamInfo.mimetype || "").toLowerCase();
    const extension = (streamInfo.extension || "").toLowerCase();

    if (!this.getVideoId(url)) {
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
    _options?: ConvertOptions,
  ): DocumentConverterResult {
    const encoding = streamInfo.charset || "utf-8";
    const html = fileStream.toString(encoding as BufferEncoding);
    const $ = cheerio.load(html);

    // Read meta tags
    const metadata: Record<string, string> = {};

    const titleTag = $("title").text();
    if (titleTag) metadata["title"] = titleTag;

    $("meta").each((_i, el) => {
      const $el = $(el);
      const key =
        $el.attr("property") || $el.attr("name") || $el.attr("itemprop") || "";
      const content = $el.attr("content") || "";
      if (key && content) {
        metadata[key] = content;
      }
    });

    // Build Markdown
    let webpage_text = "# YouTube\n";

    const title = metadata["title"] || metadata["og:title"] || metadata["name"] || "";
    if (title) {
      webpage_text += `\n## ${title}\n`;
    }

    let stats = "";
    if (metadata["interactionCount"]) {
      stats += `- **Views:** ${metadata["interactionCount"]}\n`;
    }
    if (metadata["keywords"]) {
      stats += `- **Keywords:** ${metadata["keywords"]}\n`;
    }
    if (metadata["duration"]) {
      stats += `- **Runtime:** ${metadata["duration"]}\n`;
    }
    if (stats) {
      webpage_text += `\n### Video Metadata\n${stats}\n`;
    }

    const description =
      metadata["description"] || metadata["og:description"] || "";
    if (description) {
      webpage_text += `\n### Description\n${description}\n`;
    }

    return new DocumentConverterResult({
      markdown: webpage_text,
      title: title || undefined,
    });
  }
}
