/**
 * MarkItDown — Core engine class.
 * TypeScript port of Python's `_markitdown.py`.
 *
 * Manages a priority-sorted registry of DocumentConverters and orchestrates
 * file-to-Markdown conversion with automatic format detection.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { URL } from "node:url";

import type { StreamInfo } from "./stream-info.js";
import { copyAndUpdateStreamInfo, createStreamInfo } from "./stream-info.js";
import {
  DocumentConverter,
  DocumentConverterResult,
  type ConvertOptions,
} from "./base-converter.js";
import {
  FileConversionError,
  UnsupportedFormatError,
  type FailedConversionAttempt,
} from "./exceptions.js";
import { fileUriToPath, parseDataUri } from "./uri-utils.js";
import { getStreamInfoGuesses } from "./detect.js";
import {
  PlainTextConverter,
  HtmlConverter,
  CsvConverter,
  PdfConverter,
  DocxConverter,
  XlsxConverter,
  XlsConverter,
  PptxConverter,
  ImageConverter,
  AudioConverter,
  EpubConverter,
  ZipConverter,
  YouTubeConverter,
  WikipediaConverter,
  RssConverter,
  IpynbConverter,
  BingSerpConverter,
  OutlookMsgConverter,
} from "./converters/index.js";

/** Lower priority values are tried first */
export const PRIORITY_SPECIFIC_FILE_FORMAT = 0.0;
export const PRIORITY_GENERIC_FILE_FORMAT = 10.0;

interface ConverterRegistration {
  converter: DocumentConverter;
  priority: number;
}

export interface MarkItDownOptions {
  /** Enable built-in converters (default: true) */
  enableBuiltins?: boolean;
  /** Enable plugin loading (default: false) */
  enablePlugins?: boolean;
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
}

export class MarkItDown {
  private converters: ConverterRegistration[] = [];
  private builtinsEnabled = false;
  private pluginsEnabled = false;
  private llmClient?: unknown;
  private llmModel?: string;
  private llmPrompt?: string;
  private exiftoolPath?: string;
  private styleMap?: string;

  constructor(options: MarkItDownOptions = {}) {
    this.llmClient = options.llmClient;
    this.llmModel = options.llmModel;
    this.llmPrompt = options.llmPrompt;
    this.exiftoolPath = options.exiftoolPath;
    this.styleMap = options.styleMap;

    if (options.enableBuiltins !== false) {
      this.enableBuiltins();
    }

    if (options.enablePlugins) {
      this.enablePlugins();
    }
  }

  /**
   * Enable and register built-in converters.
   */
  enableBuiltins(): void {
    if (this.builtinsEnabled) return;

    // Register converters. Later registrations are tried first at the same priority.
    // Most specific converters should appear below the most generic converters.
    this.registerConverter(new PlainTextConverter(), PRIORITY_GENERIC_FILE_FORMAT);
    this.registerConverter(
      new ZipConverter(this as any),
      PRIORITY_GENERIC_FILE_FORMAT,
    );
    this.registerConverter(new HtmlConverter(), PRIORITY_GENERIC_FILE_FORMAT);
    this.registerConverter(new RssConverter());
    this.registerConverter(new WikipediaConverter());
    this.registerConverter(new YouTubeConverter());
    this.registerConverter(new BingSerpConverter());
    this.registerConverter(new DocxConverter());
    this.registerConverter(new XlsxConverter());
    this.registerConverter(new XlsConverter());
    this.registerConverter(new PptxConverter());
    this.registerConverter(new AudioConverter());
    this.registerConverter(new ImageConverter());
    this.registerConverter(new IpynbConverter());
    this.registerConverter(new PdfConverter());
    this.registerConverter(new EpubConverter());
    this.registerConverter(new CsvConverter());
    this.registerConverter(new OutlookMsgConverter());

    this.builtinsEnabled = true;
  }

  /**
   * Enable plugin loading.
   * Scans node_modules for packages with "markitdown-plugin" keyword.
   */
  enablePlugins(): void {
    if (this.pluginsEnabled) return;
    // Plugin discovery will be implemented in a future version
    this.pluginsEnabled = true;
  }

  /**
   * Register a DocumentConverter with a given priority.
   */
  registerConverter(
    converter: DocumentConverter,
    priority: number = PRIORITY_SPECIFIC_FILE_FORMAT,
  ): void {
    this.converters.unshift({ converter, priority });
  }

  /**
   * Convert any supported source to Markdown.
   * Source can be a file path, URL, or Buffer.
   */
  async convert(
    source: string | Buffer,
    options?: { streamInfo?: StreamInfo } & ConvertOptions,
  ): Promise<DocumentConverterResult> {
    if (typeof source === "string") {
      // Check if it's a URI
      try {
        const url = new URL(source);
        if (["http:", "https:", "file:", "data:"].includes(url.protocol)) {
          return this.convertUri(source, options);
        }
      } catch {
        // Not a valid URL — treat as local path
      }
      return this.convertLocal(source, options);
    }

    // Buffer
    return this.convertStream(source, options);
  }

  /**
   * Convert a local file to Markdown.
   */
  async convertLocal(
    filePath: string,
    options?: { streamInfo?: StreamInfo } & ConvertOptions,
  ): Promise<DocumentConverterResult> {
    const resolvedPath = path.resolve(filePath);
    const buffer = fs.readFileSync(resolvedPath);

    const baseGuess: StreamInfo = {
      localPath: resolvedPath,
      extension: path.extname(resolvedPath),
      filename: path.basename(resolvedPath),
    };

    const streamInfo = options?.streamInfo
      ? copyAndUpdateStreamInfo(baseGuess, options.streamInfo)
      : createStreamInfo(baseGuess);

    const guesses = await getStreamInfoGuesses(buffer, streamInfo);
    return this._convert(buffer, guesses, options);
  }

  /**
   * Convert a Buffer stream to Markdown.
   */
  async convertStream(
    stream: Buffer,
    options?: { streamInfo?: StreamInfo } & ConvertOptions,
  ): Promise<DocumentConverterResult> {
    const baseGuess = options?.streamInfo || createStreamInfo();
    const guesses = await getStreamInfoGuesses(stream, baseGuess);
    return this._convert(stream, guesses, options);
  }

  /**
   * Convert a URI (http, https, file, data) to Markdown.
   */
  async convertUri(
    uri: string,
    options?: { streamInfo?: StreamInfo } & ConvertOptions,
  ): Promise<DocumentConverterResult> {
    uri = uri.trim();
    const parsed = new URL(uri);

    if (parsed.protocol === "file:") {
      const [netloc, filePath] = fileUriToPath(uri);
      if (netloc && netloc !== "localhost") {
        throw new Error(`Unsupported file URI: ${uri}`);
      }
      return this.convertLocal(filePath, options);
    }

    if (parsed.protocol === "data:") {
      const [mimetype, attributes, data] = parseDataUri(uri);
      const si = copyAndUpdateStreamInfo(
        { mimetype: mimetype || undefined, charset: attributes.charset },
        options?.streamInfo,
      );
      return this.convertStream(data, { ...options, streamInfo: si });
    }

    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      const response = await fetch(uri, {
        headers: {
          Accept:
            "text/markdown, text/html;q=0.9, text/plain;q=0.8, */*;q=0.1",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      // Extract content type info
      const contentType = response.headers.get("content-type") || "";
      const [mime, ...params] = contentType.split(";");
      let charset: string | undefined;
      for (const param of params) {
        const trimmed = param.trim();
        if (trimmed.startsWith("charset=")) {
          charset = trimmed.split("=")[1]?.trim();
        }
      }

      // Try to get filename from content-disposition or URL
      let filename: string | undefined;
      let extension: string | undefined;
      const contentDisposition = response.headers.get("content-disposition");
      if (contentDisposition) {
        const match = contentDisposition.match(/filename[*]?=['"]?([^'";]+)/i);
        if (match) {
          filename = match[1];
          extension = path.extname(filename);
        }
      }
      if (!filename) {
        const urlPath = parsed.pathname;
        const ext = path.extname(urlPath);
        if (ext) {
          filename = path.basename(urlPath);
          extension = ext;
        }
      }

      const baseGuess: StreamInfo = {
        mimetype: mime.trim() || undefined,
        charset,
        filename,
        extension,
        url: response.url,
      };

      const streamInfo = options?.streamInfo
        ? copyAndUpdateStreamInfo(baseGuess, options.streamInfo)
        : createStreamInfo(baseGuess);

      const guesses = await getStreamInfoGuesses(buffer, streamInfo);
      return this._convert(buffer, guesses, options);
    }

    throw new Error(
      `Unsupported URI scheme: ${parsed.protocol}. Supported: file:, data:, http:, https:`,
    );
  }

  /**
   * Internal conversion engine.
   * Tries each converter against each stream info guess.
   */
  private async _convert(
    buffer: Buffer,
    streamInfoGuesses: StreamInfo[],
    options?: ConvertOptions,
  ): Promise<DocumentConverterResult> {
    const failedAttempts: FailedConversionAttempt[] = [];

    // Sort converters by priority (stable sort)
    const sortedRegistrations = [...this.converters].sort(
      (a, b) => a.priority - b.priority,
    );

    // Build options with global defaults
    const mergedOptions: ConvertOptions = {
      ...options,
      llmClient: options?.llmClient ?? this.llmClient,
      llmModel: options?.llmModel ?? this.llmModel,
      llmPrompt: options?.llmPrompt ?? this.llmPrompt,
      exiftoolPath: options?.exiftoolPath ?? this.exiftoolPath,
      styleMap: options?.styleMap ?? this.styleMap,
    };

    // Try each guess × each converter
    const allGuesses = [...streamInfoGuesses, createStreamInfo()];

    for (const streamInfo of allGuesses) {
      for (const registration of sortedRegistrations) {
        const { converter } = registration;

        // Add legacy kwargs for compatibility
        const opts = { ...mergedOptions };
        if (streamInfo.extension) opts.fileExtension = streamInfo.extension;
        if (streamInfo.url) opts.url = streamInfo.url;

        // Check if the converter accepts this file
        let accepts = false;
        try {
          const result = converter.accepts(buffer, streamInfo, opts);
          accepts = result instanceof Promise ? await result : result;
        } catch {
          // Skip converters that throw during accepts
        }

        if (!accepts) continue;

        // Attempt conversion
        try {
          let result = converter.convert(buffer, streamInfo, opts);
          if (result instanceof Promise) {
            result = await result;
          }

          if (result) {
            // Normalize the content
            result.markdown = result.markdown
              .split(/\r?\n/)
              .map((line) => line.trimEnd())
              .join("\n");
            result.markdown = result.markdown.replace(/\n{3,}/g, "\n\n");
            return result;
          }
        } catch (error) {
          failedAttempts.push({
            converterName: converter.constructor.name,
            error: error as Error,
          });
        }
      }
    }

    // Report failures
    if (failedAttempts.length > 0) {
      throw new FileConversionError(undefined, failedAttempts);
    }

    throw new UnsupportedFormatError(
      "Could not convert to Markdown. No converter attempted a conversion, " +
        "suggesting that the filetype is simply not supported.",
    );
  }
}
