/**
 * ImageConverter — extracts EXIF metadata and optionally uses LLM for descriptions.
 * TypeScript port of Python's `_image_converter.py`.
 * Uses `exifreader` for EXIF metadata extraction.
 */
import {
  DocumentConverter,
  DocumentConverterResult,
  type ConvertOptions,
} from "../base-converter.js";
import type { StreamInfo } from "../stream-info.js";
import { llmCaption } from "../llm-caption.js";

const ACCEPTED_MIME_TYPE_PREFIXES = ["image/jpeg", "image/png"];
const ACCEPTED_FILE_EXTENSIONS = [".jpg", ".jpeg", ".png"];

import ExifReader from "exifreader";

export class ImageConverter extends DocumentConverter {
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
    streamInfo: StreamInfo,
    options?: ConvertOptions,
  ): Promise<DocumentConverterResult> {
    let mdContent = "";

    // Extract EXIF metadata
    if (ExifReader) {
      try {
        const tags = ExifReader.load(fileStream, { expanded: true });
        const fieldsToExtract = [
          "ImageWidth",
          "ImageHeight",
          "Title",
          "Caption",
          "ImageDescription",
          "Keywords",
          "Artist",
          "Author",
          "DateTimeOriginal",
          "CreateDate",
          "GPSLatitude",
          "GPSLongitude",
        ];

        // Flatten tags from all groups
        const allTags: Record<string, string> = {};
        for (const group of Object.values(tags)) {
          if (typeof group === "object" && group !== null) {
            for (const [key, val] of Object.entries(group as Record<string, any>)) {
              if (val?.description) {
                allTags[key] = String(val.description);
              } else if (val?.value !== undefined) {
                allTags[key] = String(val.value);
              }
            }
          }
        }

        // Extract image size
        if (allTags["ImageWidth"] && allTags["ImageHeight"]) {
          mdContent += `ImageSize: ${allTags["ImageWidth"]}x${allTags["ImageHeight"]}\n`;
        }

        for (const field of fieldsToExtract) {
          if (field === "ImageWidth" || field === "ImageHeight") continue;
          if (allTags[field]) {
            mdContent += `${field}: ${allTags[field]}\n`;
          }
        }
      } catch {
        // EXIF extraction failed; continue without metadata
      }
    }

    // LLM description
    const llmClient = options?.llmClient;
    if (llmClient) {
      try {
        const description = await llmCaption(fileStream, streamInfo, {
          client: llmClient,
          model: options?.llmModel,
          prompt: options?.llmPrompt,
        });
        if (description) {
          mdContent += "\n# Description:\n" + description.trim() + "\n";
        }
      } catch {
        // LLM description failed; continue without it
      }
    }

    return new DocumentConverterResult({ markdown: mdContent });
  }
}
