/**
 * AudioConverter — extracts audio metadata.
 * TypeScript port of Python's `_audio_converter.py`.
 * Uses `music-metadata` for metadata extraction.
 */
import {
  DocumentConverter,
  DocumentConverterResult,
  type ConvertOptions,
} from "../base-converter.js";
import type { StreamInfo } from "../stream-info.js";

const ACCEPTED_MIME_TYPE_PREFIXES = [
  "audio/x-wav",
  "audio/mpeg",
  "video/mp4",
];

const ACCEPTED_FILE_EXTENSIONS = [".wav", ".mp3", ".m4a", ".mp4"];

export class AudioConverter extends DocumentConverter {
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
    let mdContent = "";

    // Try extracting metadata with music-metadata
    try {
      const mm = await import("music-metadata");
      const metadata = await mm.parseBuffer(fileStream);

      const common = metadata.common;
      const format = metadata.format;

      const fields: [string, unknown][] = [
        ["Title", common.title],
        ["Artist", common.artist],
        ["Album", common.album],
        ["Genre", common.genre?.join(", ")],
        ["Track", common.track?.no],
        ["Year", common.year],
        ["Duration", format.duration ? `${format.duration.toFixed(1)}s` : undefined],
        ["Channels", format.numberOfChannels],
        ["SampleRate", format.sampleRate],
        ["Bitrate", format.bitrate ? `${Math.round(format.bitrate / 1000)}kbps` : undefined],
        ["Codec", format.codec],
      ];

      for (const [name, value] of fields) {
        if (value !== undefined && value !== null && value !== "") {
          mdContent += `${name}: ${value}\n`;
        }
      }
    } catch {
      // music-metadata not available or parsing failed
    }

    // Note: Audio transcription (SpeechRecognition) is not available in Node.js
    // without external services. This can be added via a plugin using a cloud API.

    return new DocumentConverterResult({ markdown: mdContent.trim() });
  }
}
