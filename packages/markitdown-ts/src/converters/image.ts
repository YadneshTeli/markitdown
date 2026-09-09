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
    const llmModel = options?.llmModel;
    if (llmClient && llmModel) {
      try {
        const description = await this.getLlmDescription(
          fileStream,
          streamInfo,
          llmClient,
          llmModel as string,
          options?.llmPrompt as string | undefined,
        );
        if (description) {
          mdContent += "\n# Description:\n" + description.trim() + "\n";
        }
      } catch {
        // LLM description failed; continue without it
      }
    }

    return new DocumentConverterResult({ markdown: mdContent });
  }

  private async getLlmDescription(
    fileStream: Buffer,
    streamInfo: StreamInfo,
    client: any,
    model: string,
    prompt?: string,
  ): Promise<string | null> {
    if (!prompt?.trim()) {
      prompt = "Write a detailed caption for this image.";
    }

    const contentType = streamInfo.mimetype || "application/octet-stream";
    const base64Image = fileStream.toString("base64");
    const dataUri = `data:${contentType};base64,${base64Image}`;

    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: dataUri } },
            ],
          },
        ],
      });
      return response.choices[0]?.message?.content || null;
    } catch {
      return null;
    }
  }
}
