/**
 * EpubConverter — converts EPUB files to Markdown.
 * TypeScript port of Python's `_epub_converter.py`.
 * Uses JSZip + fast-xml-parser for EPUB parsing.
 */
import {
  DocumentConverter,
  DocumentConverterResult,
  type ConvertOptions,
} from "../base-converter.js";
import type { StreamInfo } from "../stream-info.js";
import { HtmlConverter } from "./html.js";

const ACCEPTED_MIME_TYPE_PREFIXES = [
  "application/epub",
  "application/epub+zip",
  "application/x-epub+zip",
];

const ACCEPTED_FILE_EXTENSIONS = [".epub"];

import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

/**
 * Extract text content from XML nodes.
 */
function getTextFromNode(parsed: any, tagName: string): string | null {
  const texts = getAllTextsFromNodes(parsed, tagName);
  return texts.length > 0 ? texts[0] : null;
}

function getAllTextsFromNodes(parsed: any, tagName: string): string[] {
  const results: string[] = [];

  function search(obj: any): void {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      for (const item of obj) search(item);
      return;
    }
    for (const [key, value] of Object.entries(obj)) {
      if (key === tagName || key.endsWith(`:${tagName.split(":").pop()}`)) {
        if (typeof value === "string") {
          results.push(value);
        } else if (typeof value === "object" && value !== null) {
          const text = extractTextValue(value);
          if (text) results.push(text);
        }
      }
      if (typeof value === "object") search(value);
    }
  }

  function extractTextValue(obj: any): string {
    if (typeof obj === "string") return obj;
    if (obj?.["#text"]) return String(obj["#text"]);
    if (Array.isArray(obj)) return obj.map(extractTextValue).join("");
    return "";
  }

  search(parsed);
  return results;
}

export class EpubConverter extends DocumentConverter {
  private htmlConverter = new HtmlConverter();

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
    _streamInfo: StreamInfo,
    options?: ConvertOptions,
  ): Promise<DocumentConverterResult> {
    if (!JSZip) {
      throw new Error("jszip is required for EPUB conversion. Install it with: npm install jszip");
    }
    if (!XMLParser) {
      throw new Error("fast-xml-parser is required for EPUB conversion. Install it with: npm install fast-xml-parser");
    }

    const zip = await JSZip.loadAsync(fileStream);
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      textNodeName: "#text",
    });

    // Read container.xml to find content.opf path
    const containerFile = zip.file("META-INF/container.xml");
    if (!containerFile) {
      throw new Error("Invalid EPUB: missing META-INF/container.xml");
    }

    const containerXml = await containerFile.async("text");
    const containerData = parser.parse(containerXml);

    // Extract rootfile full-path
    const rootfiles = containerData?.container?.rootfiles?.rootfile;
    const rootfile = Array.isArray(rootfiles) ? rootfiles[0] : rootfiles;
    const opfPath = rootfile?.["@_full-path"];
    if (!opfPath) {
      throw new Error("Invalid EPUB: cannot find content.opf path");
    }

    // Read content.opf
    const opfFile = zip.file(opfPath);
    if (!opfFile) {
      throw new Error(`Invalid EPUB: missing ${opfPath}`);
    }

    const opfXml = await opfFile.async("text");
    const opfData = parser.parse(opfXml);
    const pkg = opfData?.["package"] || opfData?.["opf:package"] || opfData;

    // Extract metadata
    const metadata: Record<string, string | null> = {
      title: getTextFromNode(pkg, "dc:title"),
      authors: getAllTextsFromNodes(pkg, "dc:creator").join(", ") || null,
      language: getTextFromNode(pkg, "dc:language"),
      publisher: getTextFromNode(pkg, "dc:publisher"),
      date: getTextFromNode(pkg, "dc:date"),
      description: getTextFromNode(pkg, "dc:description"),
    };

    // Extract manifest (id → href mapping)
    const manifestSection = pkg?.manifest?.item;
    const manifest: Record<string, string> = {};
    if (manifestSection) {
      const items = Array.isArray(manifestSection)
        ? manifestSection
        : [manifestSection];
      for (const item of items) {
        if (item?.["@_id"] && item?.["@_href"]) {
          manifest[item["@_id"]] = item["@_href"];
        }
      }
    }

    // Extract spine order
    const spineSection = pkg?.spine?.itemref;
    const spineOrder: string[] = [];
    if (spineSection) {
      const refs = Array.isArray(spineSection) ? spineSection : [spineSection];
      for (const ref of refs) {
        if (ref?.["@_idref"]) {
          spineOrder.push(ref["@_idref"]);
        }
      }
    }

    // Build file paths from spine
    const basePath = opfPath.includes("/")
      ? opfPath.substring(0, opfPath.lastIndexOf("/"))
      : "";

    const spine: string[] = spineOrder
      .filter((id) => id in manifest)
      .map((id) => (basePath ? `${basePath}/${manifest[id]}` : manifest[id]));

    // Convert each spine item
    const markdownContent: string[] = [];

    for (const filePath of spine) {
      const file = zip.file(filePath);
      if (!file) continue;

      const htmlBuffer = Buffer.from(await file.async("arraybuffer"));
      const ext = filePath.includes(".")
        ? filePath.substring(filePath.lastIndexOf("."))
        : ".html";

      try {
        const result = this.htmlConverter.convert(htmlBuffer, {
          mimetype: ext === ".xhtml" ? "application/xhtml+xml" : "text/html",
          extension: ext,
          charset: "utf-8",
        }, options);

        const md = result instanceof Promise ? (await result).markdown : result.markdown;
        if (md.trim()) {
          markdownContent.push(md.trim());
        }
      } catch {
        // Skip files that fail to convert
      }
    }

    // Format metadata
    const metadataLines: string[] = [];
    for (const [key, value] of Object.entries(metadata)) {
      if (value) {
        metadataLines.push(
          `**${key.charAt(0).toUpperCase() + key.slice(1)}:** ${value}`,
        );
      }
    }

    if (metadataLines.length > 0) {
      markdownContent.unshift(metadataLines.join("\n"));
    }

    return new DocumentConverterResult({
      markdown: markdownContent.join("\n\n"),
      title: metadata.title || undefined,
    });
  }
}
