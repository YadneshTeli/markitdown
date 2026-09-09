/**
 * PptxConverter — converts PPTX files to Markdown.
 * TypeScript port of Python's `_pptx_converter.py`.
 * Uses JSZip + fast-xml-parser to extract content from OOXML.
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

const ACCEPTED_MIME_TYPE_PREFIXES = [
  "application/vnd.openxmlformats-officedocument.presentationml",
];
const ACCEPTED_FILE_EXTENSIONS = [".pptx"];

import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

/**
 * Recursively extract text from OOXML nodes.
 */
function extractText(node: any): string {
  if (typeof node === "string") return node;
  if (!node || typeof node !== "object") return "";

  let text = "";

  // Direct text content
  if (node["a:t"] !== undefined) {
    const t = node["a:t"];
    if (typeof t === "string") text += t;
    else if (typeof t === "object" && t["#text"]) text += t["#text"];
  }

  // Recurse into arrays
  if (Array.isArray(node)) {
    for (const item of node) {
      text += extractText(item);
    }
    return text;
  }

  // Recurse into child objects
  for (const key of Object.keys(node)) {
    if (key === "a:t") continue; // Already handled
    const val = node[key];
    if (typeof val === "object") {
      text += extractText(val);
    }
  }

  return text;
}

/**
 * Extract text from a shape element.
 */
function extractShapeText(shape: any): string {
  const txBody =
    shape["p:txBody"] || shape["p:sp"]?.["p:txBody"];
  if (!txBody) return "";

  const paragraphs = txBody["a:p"];
  if (!paragraphs) return "";

  const pList = Array.isArray(paragraphs) ? paragraphs : [paragraphs];
  const lines: string[] = [];

  for (const p of pList) {
    const line = extractText(p);
    if (line) lines.push(line);
  }

  return lines.join("\n");
}

export class PptxConverter extends DocumentConverter {
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
    _options?: ConvertOptions,
  ): Promise<DocumentConverterResult> {
    if (!JSZip) {
      throw new MissingDependencyError(
        buildMissingDependencyMessage("PptxConverter", ".pptx", "jszip"),
      );
    }
    if (!XMLParser) {
      throw new MissingDependencyError(
        buildMissingDependencyMessage(
          "PptxConverter",
          ".pptx",
          "fast-xml-parser",
        ),
      );
    }

    const zip = await JSZip.loadAsync(fileStream);
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      textNodeName: "#text",
    });

    // Read presentation.xml to get slide order
    const presFile = zip.file("ppt/presentation.xml");
    if (!presFile) {
      throw new Error("Invalid PPTX: missing ppt/presentation.xml");
    }

    // Find all slide files
    const slideFiles: string[] = [];
    zip.forEach((relativePath) => {
      if (/^ppt\/slides\/slide\d+\.xml$/.test(relativePath)) {
        slideFiles.push(relativePath);
      }
    });

    // Sort slides by number
    slideFiles.sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)/)?.[1] || "0");
      const numB = parseInt(b.match(/slide(\d+)/)?.[1] || "0");
      return numA - numB;
    });

    let mdContent = "";

    for (let slideIdx = 0; slideIdx < slideFiles.length; slideIdx++) {
      const slideFile = zip.file(slideFiles[slideIdx]);
      if (!slideFile) continue;

      const slideXml = await slideFile.async("text");
      const slideData = parser.parse(slideXml);

      mdContent += `\n\n<!-- Slide number: ${slideIdx + 1} -->\n`;

      // Extract shapes from slide
      const spTree =
        slideData?.["p:sld"]?.["p:cSld"]?.["p:spTree"];
      if (!spTree) continue;

      // Get all shape elements
      const shapes = spTree["p:sp"];
      if (!shapes) continue;

      const shapeList = Array.isArray(shapes) ? shapes : [shapes];

      let isFirstShape = true;
      for (const shape of shapeList) {
        const text = extractShapeText(shape);
        if (!text.trim()) continue;

        if (isFirstShape) {
          // First shape with text is likely the title
          mdContent += `# ${text.trim()}\n`;
          isFirstShape = false;
        } else {
          mdContent += text.trim() + "\n";
        }
      }

      // Extract tables
      const graphicFrames = spTree["p:graphicFrame"];
      if (graphicFrames) {
        const frames = Array.isArray(graphicFrames)
          ? graphicFrames
          : [graphicFrames];
        for (const frame of frames) {
          const table =
            frame?.["a:graphic"]?.["a:graphicData"]?.["a:tbl"];
          if (!table) continue;

          const trs = table["a:tr"];
          if (!trs) continue;

          const trList = Array.isArray(trs) ? trs : [trs];
          const rows: string[][] = [];

          for (const tr of trList) {
            const tcs = tr["a:tc"];
            if (!tcs) continue;
            const tcList = Array.isArray(tcs) ? tcs : [tcs];
            const row: string[] = [];
            for (const tc of tcList) {
              row.push(extractText(tc).trim());
            }
            rows.push(row);
          }

          if (rows.length > 0) {
            // Build Markdown table
            mdContent += "\n";
            mdContent += "| " + rows[0].join(" | ") + " |\n";
            mdContent += "| " + rows[0].map(() => "---").join(" | ") + " |\n";
            for (let r = 1; r < rows.length; r++) {
              mdContent += "| " + rows[r].join(" | ") + " |\n";
            }
          }
        }
      }

      // Extract notes
      const notesPath = slideFiles[slideIdx].replace(
        "slides/slide",
        "notesSlides/notesSlide",
      );
      const notesFile = zip.file(notesPath);
      if (notesFile) {
        try {
          const notesXml = await notesFile.async("text");
          const notesData = parser.parse(notesXml);
          const noteBody =
            notesData?.["p:notes"]?.["p:cSld"]?.["p:spTree"];
          if (noteBody) {
            const noteShapes = noteBody["p:sp"];
            if (noteShapes) {
              const noteList = Array.isArray(noteShapes)
                ? noteShapes
                : [noteShapes];
              const noteTexts: string[] = [];
              for (const ns of noteList) {
                const nt = extractShapeText(ns);
                if (nt.trim()) noteTexts.push(nt.trim());
              }
              if (noteTexts.length > 0) {
                mdContent += "\n\n### Notes:\n" + noteTexts.join("\n");
              }
            }
          }
        } catch {
          // Notes extraction failed; skip
        }
      }
    }

    return new DocumentConverterResult({ markdown: mdContent.trim() });
  }
}
