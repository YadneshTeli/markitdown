/**
 * CsvConverter — converts CSV files to Markdown tables.
 * TypeScript port of Python's `_csv_converter.py`.
 */
import {
  DocumentConverter,
  DocumentConverterResult,
  type ConvertOptions,
} from "../base-converter.js";
import type { StreamInfo } from "../stream-info.js";
import iconv from "iconv-lite";

const ACCEPTED_MIME_TYPE_PREFIXES = ["text/csv", "application/csv"];
const ACCEPTED_FILE_EXTENSIONS = [".csv"];

/**
 * Escape a CSV value so it is safe inside a Markdown table cell.
 */
function escapeTableCell(value: string): string {
  // Escape pipe characters (Markdown column separator)
  value = value.replace(/(\\\*)\|/g, "$1$1\\|").replace(/\|/g, "\\|");
  // Collapse line breaks
  return value.replace(/\r\n/g, " ").replace(/\n/g, " ").replace(/\r/g, " ");
}

/**
 * Simple CSV parser that handles quoted fields.
 */
function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  let i = 0;

  while (i < content.length) {
    const char = content[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < content.length && content[i + 1] === '"') {
          currentField += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        currentField += char;
        i++;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
      } else if (char === ",") {
        currentRow.push(currentField);
        currentField = "";
        i++;
      } else if (char === "\r" && i + 1 < content.length && content[i + 1] === "\n") {
        currentRow.push(currentField);
        currentField = "";
        rows.push(currentRow);
        currentRow = [];
        i += 2;
      } else if (char === "\n") {
        currentRow.push(currentField);
        currentField = "";
        rows.push(currentRow);
        currentRow = [];
        i++;
      } else {
        currentField += char;
        i++;
      }
    }
  }

  // Don't forget last field/row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Remove empty rows from the beginning and end, and immediately after the header.
 */
function trimOuterBlankRows(rows: string[][]): string[][] {
  const result = [...rows];

  // Remove empty rows from beginning
  while (result.length > 0 && result[0].every((c) => !c.trim())) {
    result.shift();
  }

  // Remove empty rows after header
  while (result.length > 1 && result[1].every((c) => !c.trim())) {
    result.splice(1, 1);
  }

  // Remove empty rows from end
  while (result.length > 0 && result[result.length - 1].every((c) => !c.trim())) {
    result.pop();
  }

  return result;
}

export class CsvConverter extends DocumentConverter {
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
    _options?: ConvertOptions,
  ): DocumentConverterResult {
    let content: string;
    if (streamInfo.charset) {
      try {
        content = iconv.decode(fileStream, streamInfo.charset);
      } catch {
        content = fileStream.toString(streamInfo.charset as BufferEncoding);
      }
    } else {
      content = fileStream.toString("utf-8");
    }

    // Strip UTF-8 BOM
    content = content.replace(/^\uFEFF/, "");

    const rows = trimOuterBlankRows(parseCsv(content));

    if (rows.length === 0) {
      return new DocumentConverterResult({ markdown: "" });
    }

    const markdownTable: string[] = [];

    // Header row
    const header = rows[0].map(escapeTableCell);
    markdownTable.push("| " + header.join(" | ") + " |");

    // Separator row
    markdownTable.push("| " + rows[0].map(() => "---").join(" | ") + " |");

    // Data rows
    for (let i = 1; i < rows.length; i++) {
      let row = rows[i];
      // Ensure same number of columns as header
      while (row.length < rows[0].length) {
        row.push("");
      }
      row = row.slice(0, rows[0].length);
      markdownTable.push("| " + row.map(escapeTableCell).join(" | ") + " |");
    }

    return new DocumentConverterResult({ markdown: markdownTable.join("\n") });
  }
}
