/**
 * XlsxConverter — converts XLSX files to Markdown tables.
 * TypeScript port of Python's `_xlsx_converter.py`.
 * Uses `exceljs` for reading spreadsheets.
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

const ACCEPTED_XLSX_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const ACCEPTED_XLSX_EXTENSIONS = [".xlsx"];

const ACCEPTED_XLS_MIME_TYPES = [
  "application/vnd.ms-excel",
  "application/excel",
];
const ACCEPTED_XLS_EXTENSIONS = [".xls"];

import ExcelJS from "exceljs";
import * as XLSX from "xlsx";

/**
 * Convert a worksheet to a Markdown table.
 */
function worksheetToMarkdown(worksheet: any): string {
  const rows: string[][] = [];

  worksheet.eachRow({ includeEmpty: false }, (row: any) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell: any) => {
      const value = cell.text || cell.value;
      cells.push(value != null ? String(value) : "");
    });
    rows.push(cells);
  });

  if (rows.length === 0) return "";

  // Normalize column count to the maximum across all rows
  const maxCols = Math.max(...rows.map((r) => r.length));
  for (const row of rows) {
    while (row.length < maxCols) {
      row.push("");
    }
  }

  // Build Markdown table
  const lines: string[] = [];

  // Header
  const header = rows[0];
  lines.push("| " + header.join(" | ") + " |");

  // Separator
  lines.push("| " + header.map(() => "---").join(" | ") + " |");

  // Data rows
  for (let i = 1; i < rows.length; i++) {
    lines.push("| " + rows[i].join(" | ") + " |");
  }

  return lines.join("\n");
}

export class XlsxConverter extends DocumentConverter {
  accepts(
    _fileStream: Buffer,
    streamInfo: StreamInfo,
    _options?: ConvertOptions,
  ): boolean {
    const mimetype = (streamInfo.mimetype || "").toLowerCase();
    const extension = (streamInfo.extension || "").toLowerCase();

    if (ACCEPTED_XLSX_EXTENSIONS.includes(extension)) return true;

    for (const prefix of ACCEPTED_XLSX_MIME_TYPES) {
      if (mimetype.startsWith(prefix)) return true;
    }

    return false;
  }

  async convert(
    fileStream: Buffer,
    _streamInfo: StreamInfo,
    _options?: ConvertOptions,
  ): Promise<DocumentConverterResult> {
    if (!ExcelJS) {
      throw new MissingDependencyError(
        buildMissingDependencyMessage("XlsxConverter", ".xlsx", "exceljs"),
      );
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileStream as unknown as ArrayBuffer);

    const parts: string[] = [];

    workbook.eachSheet((worksheet) => {
      parts.push(`## ${worksheet.name}`);
      const table = worksheetToMarkdown(worksheet);
      if (table) {
        parts.push(table);
      }
    });

    return new DocumentConverterResult({ markdown: parts.join("\n\n").trim() });
  }
}

export class XlsConverter extends DocumentConverter {
  accepts(
    _fileStream: Buffer,
    streamInfo: StreamInfo,
    _options?: ConvertOptions,
  ): boolean {
    const mimetype = (streamInfo.mimetype || "").toLowerCase();
    const extension = (streamInfo.extension || "").toLowerCase();

    if (ACCEPTED_XLS_EXTENSIONS.includes(extension)) return true;

    for (const prefix of ACCEPTED_XLS_MIME_TYPES) {
      if (mimetype.startsWith(prefix)) return true;
    }

    return false;
  }

  async convert(
    fileStream: Buffer,
    _streamInfo: StreamInfo,
    _options?: ConvertOptions,
  ): Promise<DocumentConverterResult> {
    const workbook = XLSX.read(fileStream, { type: "buffer" });
    const parts: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      parts.push(`## ${sheetName}`);
      const rawRows = XLSX.utils.sheet_to_json<any[]>(
        workbook.Sheets[sheetName],
        { header: 1 },
      );

      if (rawRows.length > 0) {
        const rows = rawRows.map((r) =>
          (r || []).map((cell) => (cell != null ? String(cell) : "")),
        );
        const maxCols = Math.max(...rows.map((r) => r.length));
        for (const row of rows) {
          while (row.length < maxCols) {
            row.push("");
          }
        }

        const lines: string[] = [];
        lines.push("| " + rows[0].join(" | ") + " |");
        lines.push("| " + rows[0].map(() => "---").join(" | ") + " |");
        for (let i = 1; i < rows.length; i++) {
          lines.push("| " + rows[i].join(" | ") + " |");
        }
        parts.push(lines.join("\n"));
      }
    }

    return new DocumentConverterResult({
      markdown: parts.join("\n\n"),
    });
  }
}
