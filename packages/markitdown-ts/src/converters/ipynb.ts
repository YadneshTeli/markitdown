/**
 * IpynbConverter — converts Jupyter Notebook files to Markdown.
 * TypeScript port of Python's `_ipynb_converter.py`.
 */
import {
  DocumentConverter,
  DocumentConverterResult,
  type ConvertOptions,
} from "../base-converter.js";
import type { StreamInfo } from "../stream-info.js";
import { HtmlConverter } from "./html.js";

const ACCEPTED_MIME_TYPE_PREFIXES = ["application/x-ipynb+json"];
const ACCEPTED_FILE_EXTENSIONS = [".ipynb"];

export class IpynbConverter extends DocumentConverter {
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

  convert(
    fileStream: Buffer,
    _streamInfo: StreamInfo,
    options?: ConvertOptions,
  ): DocumentConverterResult {
    const content = fileStream.toString("utf-8");
    const notebook = JSON.parse(content);

    let mdContent = "";

    // Process cells
    const cells = notebook.cells || [];
    for (const cell of cells) {
      const source = Array.isArray(cell.source)
        ? cell.source.join("")
        : cell.source || "";

      if (cell.cell_type === "markdown") {
        mdContent += source + "\n\n";
      } else if (cell.cell_type === "code") {
        // Code cell
        const language =
          notebook.metadata?.kernelspec?.language ||
          notebook.metadata?.language_info?.name ||
          "";
        mdContent += "```" + language + "\n" + source + "\n```\n\n";

        // Process outputs
        const outputs = cell.outputs || [];
        for (const output of outputs) {
          if (output.output_type === "stream") {
            const text = Array.isArray(output.text)
              ? output.text.join("")
              : output.text || "";
            if (text) {
              mdContent += "**Output:**\n```\n" + text + "\n```\n\n";
            }
          } else if (
            output.output_type === "execute_result" ||
            output.output_type === "display_data"
          ) {
            const data = output.data || {};

            // Prefer HTML, then text
            if (data["text/html"]) {
              const html = Array.isArray(data["text/html"])
                ? data["text/html"].join("")
                : data["text/html"];
              const result = this.htmlConverter.convertString(html, options);
              mdContent += result.markdown + "\n\n";
            } else if (data["text/plain"]) {
              const text = Array.isArray(data["text/plain"])
                ? data["text/plain"].join("")
                : data["text/plain"];
              mdContent += "```\n" + text + "\n```\n\n";
            }

            // Image outputs
            if (data["image/png"]) {
              const imgData = Array.isArray(data["image/png"])
                ? data["image/png"].join("")
                : data["image/png"];
              if (options?.keepDataUris) {
                mdContent += `![output](data:image/png;base64,${imgData})\n\n`;
              } else {
                mdContent += "![output](data:image/png;base64,...)\n\n";
              }
            }
          } else if (output.output_type === "error") {
            const traceback = (output.traceback || []).join("\n");
            mdContent += "**Error:**\n```\n" + traceback + "\n```\n\n";
          }
        }
      } else if (cell.cell_type === "raw") {
        mdContent += source + "\n\n";
      }
    }

    return new DocumentConverterResult({ markdown: mdContent.trim() });
  }
}
