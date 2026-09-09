/**
 * MarkItDown — TypeScript port of Microsoft's markitdown Python library.
 *
 * A lightweight utility for converting various files to Markdown for use
 * with LLMs and related text analysis pipelines.
 *
 * @packageDocumentation
 */

// Core classes and types
export { MarkItDown, PRIORITY_SPECIFIC_FILE_FORMAT, PRIORITY_GENERIC_FILE_FORMAT } from "./markitdown.js";
export type { MarkItDownOptions } from "./markitdown.js";
export { DocumentConverter, DocumentConverterResult } from "./base-converter.js";
export type { ConvertOptions } from "./base-converter.js";
export type { StreamInfo } from "./stream-info.js";
export { createStreamInfo, copyAndUpdateStreamInfo } from "./stream-info.js";

// Exceptions
export {
  MarkItDownError,
  MissingDependencyError,
  UnsupportedFormatError,
  FileConversionError,
} from "./exceptions.js";
export type { FailedConversionAttempt } from "./exceptions.js";

// Individual converters (for advanced usage / plugin development)
export {
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

// Plugin system
export {
  discoverInstalledPlugins,
  loadPlugin,
  loadAndRegisterPlugins,
} from "./plugins.js";
export type { MarkItDownPlugin, DiscoveredPlugin } from "./plugins.js";

