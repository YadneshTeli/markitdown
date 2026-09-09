/**
 * OutlookMsgConverter — converts Outlook .msg files to Markdown.
 * TypeScript port of Python's `_outlook_msg_converter.py`.
 * Uses `@kenjiuno/msgreader`.
 */
import {
  DocumentConverter,
  DocumentConverterResult,
  type ConvertOptions,
} from "../base-converter.js";
import type { StreamInfo } from "../stream-info.js";
import MsgReaderModule from "@kenjiuno/msgreader";

// Handle ESM / CJS default import interop
const MsgReader = (MsgReaderModule as any).default || MsgReaderModule;

const ACCEPTED_MIME_TYPE_PREFIXES = ["application/vnd.ms-outlook"];
const ACCEPTED_FILE_EXTENSIONS = [".msg"];

export class OutlookMsgConverter extends DocumentConverter {
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
    _options?: ConvertOptions,
  ): DocumentConverterResult {
    // MsgReader requires an ArrayBuffer
    const arrayBuffer = fileStream.buffer.slice(
      fileStream.byteOffset,
      fileStream.byteOffset + fileStream.byteLength,
    );

    const reader = new MsgReader(arrayBuffer);
    const msg = reader.getFileData();

    let mdContent = "# Email Message\n\n";

    // Extract headers
    const sender = msg.senderEmail || msg.senderName;
    if (sender) {
      mdContent += `**From:** ${sender}\n`;
    }

    // Recipients
    if (msg.recipients && Array.isArray(msg.recipients)) {
      const toList: string[] = [];
      const ccList: string[] = [];

      for (const recipient of msg.recipients) {
        const addr = recipient.email || recipient.name;
        if (!addr) continue;

        const type = (recipient.recipType || "").toLowerCase();
        if (type === "to") {
          toList.push(addr);
        } else if (type === "cc") {
          ccList.push(addr);
        }
      }

      if (toList.length > 0) {
        mdContent += `**To:** ${toList.join(", ")}\n`;
      }
      if (ccList.length > 0) {
        mdContent += `**Cc:** ${ccList.join(", ")}\n`;
      }
    }

    if (msg.subject) {
      mdContent += `**Subject:** ${msg.subject}\n`;
    }

    mdContent += "\n## Content\n\n";

    if (msg.body) {
      mdContent += msg.body.trim();
    }

    return new DocumentConverterResult({
      markdown: mdContent.trim(),
      title: msg.subject || undefined,
    });
  }
}
