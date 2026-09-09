# markitdown

> Fast, lightweight, and versatile file-to-Markdown conversion for JavaScript and TypeScript.

[![npm](https://img.shields.io/npm/v/markitdown.svg)](https://www.npmjs.com/package/markitdown)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Native TypeScript port of Microsoft's [MarkItDown](https://github.com/microsoft/markitdown) library. Converts documents, spreadsheets, presentations, emails, media, feeds, and archives into clean, LLM-optimized Markdown while preserving structural hierarchy (headings, tables, lists, links, and code blocks).

---

## ⚡ Supported Formats

- **Documents**: PDF (`.pdf`), Microsoft Word (`.docx`), EPUB (`.epub`), Plain Text / Markdown (`.txt`, `.md`, `.json`)
- **Spreadsheets**: Microsoft Excel (`.xlsx`), Legacy Excel (`.xls`), CSV (`.csv` with automatic multi-charset support e.g. CP932, Shift-JIS)
- **Presentations**: Microsoft PowerPoint (`.pptx` with slides, tables, and notes)
- **Emails**: Microsoft Outlook Messages (`.msg` with headers, recipients, and body)
- **Web & Feeds**: HTML pages, Wikipedia articles, YouTube transcripts, Bing Search Results, RSS/Atom feeds
- **Notebooks**: Jupyter Notebooks (`.ipynb`)
- **Archives**: ZIP archives (`.zip` with recursive file processing)
- **Media**: JPEG, PNG, TIFF, BMP, WebP (EXIF metadata extraction + LLM vision captioning)
- **Audio**: WAV, MP3, M4A (music tags, duration, bitrate + speech-to-text transcriber hook)

---

## 📥 Installation

```bash
npm install markitdown
```

---

## 🚀 Quick Start

### Basic Conversion

```typescript
import { MarkItDown } from "markitdown";

const md = new MarkItDown();

// Convert a local file
const doc = await md.convert("quarterly-report.docx");
console.log(doc.markdown);

// Convert a web URL
const wiki = await md.convert("https://en.wikipedia.org/wiki/TypeScript");
console.log(wiki.markdown);

// Convert an in-memory buffer
const result = await md.convert(fileBuffer, {
  streamInfo: {
    extension: ".pdf",
    mimetype: "application/pdf",
  },
});
console.log(result.markdown);
```

### Multimodal Image Descriptions via LLM

```typescript
import { MarkItDown } from "markitdown";
import OpenAI from "openai";

const client = new OpenAI();
const md = new MarkItDown({
  llmClient: client,
  llmModel: "gpt-4o",
  llmPrompt: "Describe this image in detail, focusing on charts and key text.",
});

const imageResult = await md.convert("architecture_diagram.png");
console.log(imageResult.markdown);
```

### Audio Transcription Hook

```typescript
import { MarkItDown } from "markitdown";

const md = new MarkItDown();

const result = await md.convert("podcast_episode.mp3", {
  transcribeAudio: async (audioBuffer, extension) => {
    // Call Whisper API or local speech-to-text service
    return "Transcribed spoken content...";
  },
});
console.log(result.markdown);
```

---

## 💻 Command-Line Interface (CLI)

Use `markitdown` directly with `npx` or install globally:

```bash
# Convert a file to standard output
npx markitdown presentation.pptx

# Save to an output Markdown file
npx markitdown -o output.md document.pdf

# Pipe input from stdin with an extension hint
cat data.csv | npx markitdown -x .csv

# Enable 3rd-party plugins
npx markitdown -p document.rtf

# List installed plugins
npx markitdown --list-plugins
```

### CLI Options

| Flag | Description |
|---|---|
| `-o, --output <file>` | Destination file path (defaults to stdout) |
| `-x, --extension <ext>` | Format extension hint (e.g. `.pdf`, `.csv`) |
| `-m, --mime-type <type>` | MIME type hint (e.g. `application/pdf`) |
| `-c, --charset <charset>` | Character encoding hint (e.g. `utf-8`, `shift_jis`) |
| `-p, --use-plugins` | Enable installed 3rd-party plugins |
| `--list-plugins` | List all discovered 3rd-party plugins |
| `--keep-data-uris` | Preserve base64 embedded data URIs in output |

---

## 🔌 Plugins & OCR

MarkItDown supports automatic plugin discovery. Packages containing `"keywords": ["markitdown-plugin"]` or named `markitdown-plugin-*` in `node_modules` are automatically detected:

```typescript
// Enable plugins automatically
const md = new MarkItDown({ enablePlugins: true });
```

### Offline Local OCR via `markitdown-ocr`

For zero-cloud, offline OCR support using WebAssembly Tesseract:

```bash
npm install markitdown-ocr
```

```typescript
import { MarkItDown } from "markitdown";
import { registerConverters } from "markitdown-ocr";

const md = new MarkItDown();
registerConverters(md); // Registers OCR converters at priority -1.0

const scannedDoc = await md.convert("scanned_receipt.jpg");
console.log(scannedDoc.markdown);
```

---

## 🛠️ API Reference

### `new MarkItDown(options?)`
- `enableBuiltins?: boolean` — Enable built-in converters (default: `true`).
- `enablePlugins?: boolean` — Automatically discover and activate installed plugins (default: `false`).
- `llmClient?: unknown` — OpenAI or compatible API client instance for image vision descriptions.
- `llmModel?: string` — Vision model name (e.g. `"gpt-4o"`).
- `llmPrompt?: string` — Custom prompt for image captioning.

### `markitdown.convert(source, options?)`
- `source: string | Buffer` — File path, web URL (`http://`, `https://`, `file://`, `data:`), or Buffer.
- `options?: ConvertOptions` — Conversion options and hints.
- **Returns**: `Promise<DocumentConverterResult>` with `.markdown` and `.title`.

### `MarkItDown.listPlugins(startDir?)`
- Returns an array of discovered plugins in `node_modules` / workspaces.

---

## 📄 License

MIT © [Microsoft Corporation](https://github.com/microsoft/markitdown) and contributors.
