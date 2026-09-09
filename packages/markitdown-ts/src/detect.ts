/**
 * File type and charset detection layer.
 *
 * Replaces Python's Magika + charset-normalizer with:
 * - `file-type` for binary content-based detection
 * - `mime-types` for extension-based lookup
 * - `chardet` for charset detection
 */
import * as mimeTypes from "mime-types";
import chardet from "chardet";
import type { StreamInfo } from "./stream-info.js";
import { copyAndUpdateStreamInfo } from "./stream-info.js";

/**
 * Try to detect the charset of a text buffer.
 */
export function detectCharset(buffer: Buffer): string | null {
  // Simple BOM detection first
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return "utf-8";
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return "utf-16le";
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return "utf-16be";
  }

  // Try chardet if available
  try {
    const detected = chardet.detect(buffer);
    if (detected) {
      return detected.toLowerCase();
    }
  } catch {
    // chardet not available; fall through
  }

  // Heuristic: check if it looks like valid UTF-8
  try {
    const text = buffer.toString("utf-8");
    // If we can round-trip it without issues, assume UTF-8
    const re = Buffer.from(text, "utf-8");
    if (re.equals(buffer)) {
      return "utf-8";
    }
  } catch {
    // Not valid UTF-8
  }

  return null;
}

/**
 * Detect the file type from buffer content.
 * Uses the `file-type` npm package for magic-byte detection.
 */
export async function detectFileType(
  buffer: Buffer,
): Promise<{ mime: string; ext: string } | null> {
  try {
    const { fileTypeFromBuffer } = await import("file-type");
    const result = await fileTypeFromBuffer(buffer);
    if (result) {
      return { mime: result.mime, ext: `.${result.ext}` };
    }
  } catch {
    // file-type not available or detection failed
  }
  return null;
}

/**
 * Guess MIME type from an extension.
 */
export function guessMimeFromExtension(extension: string): string | null {
  const mime = mimeTypes.lookup(extension);
  return mime || null;
}

/**
 * Guess extension from a MIME type.
 */
export function guessExtensionFromMime(mime: string): string | null {
  const ext = mimeTypes.extension(mime);
  return ext ? `.${ext}` : null;
}

/**
 * Check if a MIME type represents text content.
 */
export function isTextMime(mime: string): boolean {
  const lower = mime.toLowerCase();
  return (
    lower.startsWith("text/") ||
    lower === "application/json" ||
    lower === "application/xml" ||
    lower === "application/javascript" ||
    lower === "application/markdown"
  );
}

/**
 * Build stream info guesses from a buffer and a base guess.
 * This is the equivalent of `_get_stream_info_guesses` in the Python version.
 */
export async function getStreamInfoGuesses(
  buffer: Buffer,
  baseGuess: StreamInfo,
): Promise<StreamInfo[]> {
  const guesses: StreamInfo[] = [];

  // Enhance the base guess with extension/mimetype cross-lookup
  let enhanced = { ...baseGuess };

  if (!baseGuess.mimetype && baseGuess.extension) {
    const m = guessMimeFromExtension(baseGuess.extension);
    if (m) {
      enhanced = { ...enhanced, mimetype: m };
    }
  }

  if (baseGuess.mimetype && !baseGuess.extension) {
    const e = guessExtensionFromMime(baseGuess.mimetype);
    if (e) {
      enhanced = { ...enhanced, extension: e };
    }
  }

  // Try content-based detection
  const detected = await detectFileType(buffer);

  if (detected) {
    // Also detect charset for text content
    let charset: string | null = null;
    if (isTextMime(detected.mime)) {
      charset = detectCharset(buffer.subarray(0, 65536));
    }

    // Check compatibility with base guess
    let compatible = true;
    if (baseGuess.mimetype && baseGuess.mimetype !== detected.mime) {
      compatible = false;
    }
    if (
      baseGuess.extension &&
      baseGuess.extension.toLowerCase() !== detected.ext.toLowerCase()
    ) {
      compatible = false;
    }

    if (compatible) {
      guesses.push(
        copyAndUpdateStreamInfo(baseGuess, {
          mimetype: baseGuess.mimetype || detected.mime,
          extension: baseGuess.extension || detected.ext,
          charset: baseGuess.charset || charset || undefined,
        }),
      );
    } else {
      // Incompatible: add both guesses
      guesses.push(copyAndUpdateStreamInfo(enhanced));
      guesses.push(
        copyAndUpdateStreamInfo({
          mimetype: detected.mime,
          extension: detected.ext,
          charset: charset || undefined,
          filename: baseGuess.filename,
          localPath: baseGuess.localPath,
          url: baseGuess.url,
        }),
      );
    }
  } else {
    // No content detection result — try charset detection for text heuristic
    const charset = detectCharset(buffer.subarray(0, 65536));
    if (charset) {
      guesses.push(
        copyAndUpdateStreamInfo(enhanced, { charset: enhanced.charset || charset }),
      );
    } else {
      guesses.push(copyAndUpdateStreamInfo(enhanced));
    }
  }

  return guesses;
}
