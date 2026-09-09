/**
 * RssConverter — converts RSS/Atom feeds to Markdown.
 * TypeScript port of Python's `_rss_converter.py`.
 * Uses fast-xml-parser.
 */
import {
  DocumentConverter,
  DocumentConverterResult,
  type ConvertOptions,
} from "../base-converter.js";
import type { StreamInfo } from "../stream-info.js";
import { HtmlConverter } from "./html.js";

const ACCEPTED_MIME_TYPE_PREFIXES = [
  "application/rss",
  "application/atom",
  "application/xml",
  "text/xml",
];

const ACCEPTED_FILE_EXTENSIONS = [".rss", ".atom", ".xml"];

import { XMLParser } from "fast-xml-parser";

export class RssConverter extends DocumentConverter {
  private htmlConverter = new HtmlConverter();

  accepts(
    fileStream: Buffer,
    streamInfo: StreamInfo,
    _options?: ConvertOptions,
  ): boolean {
    const mimetype = (streamInfo.mimetype || "").toLowerCase();
    const extension = (streamInfo.extension || "").toLowerCase();

    // Check MIME type
    for (const prefix of ACCEPTED_MIME_TYPE_PREFIXES) {
      if (mimetype.startsWith(prefix)) {
        // Peek at content to confirm it's RSS/Atom
        return this.looksLikeRss(fileStream);
      }
    }

    if (ACCEPTED_FILE_EXTENSIONS.includes(extension)) {
      return this.looksLikeRss(fileStream);
    }

    return false;
  }

  private looksLikeRss(buffer: Buffer): boolean {
    // Check first 500 bytes for RSS/Atom indicators
    const head = buffer.subarray(0, 500).toString("utf-8").toLowerCase();
    return (
      head.includes("<rss") ||
      head.includes("<feed") ||
      head.includes("<channel")
    );
  }

  convert(
    fileStream: Buffer,
    streamInfo: StreamInfo,
    options?: ConvertOptions,
  ): DocumentConverterResult {
    if (!XMLParser) {
      throw new Error(
        "fast-xml-parser is required for RSS conversion. Install it with: npm install fast-xml-parser",
      );
    }

    const encoding = streamInfo.charset || "utf-8";
    const xmlString = fileStream.toString(encoding as BufferEncoding);

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      textNodeName: "#text",
      processEntities: {
        maxTotalExpansions: 1000000,
      },
    });

    const parsed = parser.parse(xmlString);

    // Try RSS format
    if (parsed.rss?.channel) {
      return this.convertRss(parsed.rss.channel, options);
    }

    // Try Atom format
    if (parsed.feed) {
      return this.convertAtom(parsed.feed, options);
    }

    // Standalone channel
    if (parsed.channel) {
      return this.convertRss(parsed.channel, options);
    }

    throw new Error("Could not parse as RSS or Atom feed");
  }

  private convertRss(
    channel: any,
    options?: ConvertOptions,
  ): DocumentConverterResult {
    let md = "";

    const title = channel.title;
    const channelTitle = typeof title === "object" ? title["#text"] || "" : title || "";
    if (channelTitle) md += `# ${channelTitle}\n\n`;

    const description = channel.description;
    if (description) {
      const desc = typeof description === "object" ? description["#text"] || "" : description;
      if (desc.includes("<")) {
        md += this.htmlConverter.convertString(desc, options).markdown + "\n\n";
      } else {
        md += desc + "\n\n";
      }
    }

    // Process items
    const items = channel.item;
    if (items) {
      const itemList = Array.isArray(items) ? items : [items];
      for (const item of itemList) {
        const itemTitle = typeof item.title === "object" ? item.title["#text"] || "" : item.title || "";
        if (itemTitle) md += `## ${itemTitle}\n\n`;

        const pubDate = item.pubDate;
        if (pubDate) md += `Published on: ${pubDate}\n\n`;

        const itemDesc = typeof item.description === "object"
          ? item.description["#text"] || ""
          : item.description || "";
        if (itemDesc) {
          if (itemDesc.includes("<")) {
            md += this.htmlConverter.convertString(itemDesc, options).markdown + "\n\n";
          } else {
            md += itemDesc + "\n\n";
          }
        }

        // Support content:encoded or ns3:encoded (common in WordPress / RSS 2.0)
        const encodedContent =
          item["content:encoded"] ||
          item["ns3:encoded"] ||
          item.encoded ||
          item.content;
        if (encodedContent) {
          const contentStr =
            typeof encodedContent === "object"
              ? encodedContent["#text"] || ""
              : String(encodedContent);
          if (contentStr) {
            md += this.htmlConverter.convertString(contentStr, options).markdown + "\n\n";
          }
        }
      }
    }

    return new DocumentConverterResult({ markdown: md.trim(), title: channel.title });
  }

  private convertAtom(
    feed: any,
    options?: ConvertOptions,
  ): DocumentConverterResult {
    let md = "";

    const title = feed.title;
    if (title) md += `# ${typeof title === "object" ? title["#text"] || "" : title}\n\n`;

    const subtitle = feed.subtitle;
    if (subtitle) {
      const sub = typeof subtitle === "object" ? subtitle["#text"] || "" : subtitle;
      md += sub + "\n\n";
    }

    // Process entries
    const entries = feed.entry;
    if (entries) {
      const entryList = Array.isArray(entries) ? entries : [entries];
      for (const entry of entryList) {
        const entryTitle = typeof entry.title === "object" ? entry.title["#text"] || "" : entry.title || "";
        if (entryTitle) md += `## ${entryTitle}\n\n`;

        // Handle link (may be object with @_href)
        const link = entry.link;
        if (link) {
          const href = typeof link === "object" ? link["@_href"] || "" : link;
          if (href) md += `[Link](${href})\n\n`;
        }

        const updated = entry.updated;
        if (updated) md += `*${updated}*\n\n`;

        // Content or summary
        const content = entry.content || entry.summary;
        if (content) {
          const text = typeof content === "object" ? content["#text"] || "" : content;
          if (text.includes("<")) {
            md += this.htmlConverter.convertString(text, options).markdown + "\n\n";
          } else {
            md += text + "\n\n";
          }
        }
      }
    }

    return new DocumentConverterResult({ markdown: md.trim(), title: feed.title });
  }
}
