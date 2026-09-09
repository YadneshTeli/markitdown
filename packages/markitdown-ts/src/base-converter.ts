/**
 * Base converter types — TypeScript port of Python's `_base_converter.py`.
 */
import type { StreamInfo } from "./stream-info.js";

/**
 * The result of converting a document to Markdown.
 */
export class DocumentConverterResult {
  /** The converted Markdown text */
  public markdown: string;
  /** Optional title of the document */
  public title?: string;

  constructor(options: { markdown: string; title?: string }) {
    this.markdown = options.markdown;
    this.title = options.title;
  }

  /**
   * Soft-deprecated alias for `markdown`.
   * New code should use `markdown` or `toString()`.
   */
  get textContent(): string {
    return this.markdown;
  }

  set textContent(value: string) {
    this.markdown = value;
  }

  toString(): string {
    return this.markdown;
  }
}

/**
 * Options passed to converter methods.
 */
export interface ConvertOptions {
  [key: string]: unknown;

  /** LLM client for image descriptions */
  llmClient?: unknown;
  /** LLM model name */
  llmModel?: string;
  /** Custom LLM prompt */
  llmPrompt?: string;
  /** Path to exiftool binary */
  exiftoolPath?: string;
  /** Style map for DOCX conversion */
  styleMap?: string;
  /** Whether to keep data URIs in output */
  keepDataUris?: boolean;
  /** File extension hint (deprecated — use streamInfo) */
  fileExtension?: string;
  /** URL hint (deprecated — use streamInfo) */
  url?: string;
}

/**
 * Abstract superclass of all DocumentConverters.
 *
 * Subclasses must implement `accepts()` and `convert()`.
 */
export abstract class DocumentConverter {
  /**
   * Quick determination on whether the converter should attempt converting the document.
   * Primarily based on `streamInfo` (mimetype, extension, url, filename).
   *
   * IMPORTANT: If reading from the stream to make a determination, the position
   * MUST be reset before returning.
   */
  abstract accepts(
    fileStream: Buffer,
    streamInfo: StreamInfo,
    options?: ConvertOptions,
  ): boolean | Promise<boolean>;

  /**
   * Convert a document to Markdown text.
   *
   * @throws FileConversionException if the conversion fails
   * @throws MissingDependencyException if a required dependency is missing
   */
  abstract convert(
    fileStream: Buffer,
    streamInfo: StreamInfo,
    options?: ConvertOptions,
  ): DocumentConverterResult | Promise<DocumentConverterResult>;
}
