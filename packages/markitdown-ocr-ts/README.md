# markitdown-ocr

> Optical Character Recognition (OCR) plugin for MarkItDown TypeScript — powered by **Tesseract.js** and **LLM Vision**.

[![npm](https://img.shields.io/npm/v/markitdown-ocr.svg)](https://www.npmjs.com/package/markitdown-ocr)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🌟 Features

- **Local Offline OCR via Tesseract.js**: Pure JavaScript & WebAssembly OCR engine that runs completely offline with zero API keys or external server dependencies.
- **Cloud LLM Vision OCR**: Extract high-fidelity structured text and tables using multimodal models (`gpt-4o`, Claude, Gemini).
- **Enhanced PDF Handling**: Automatically runs OCR when converting scanned or image-only PDF documents.
- **Image OCR**: Extracts text from `.png`, `.jpg`, `.jpeg`, `.tiff`, `.bmp`, and `.webp` files.
- **Priority Replacement**: Registers converters at **priority -1.0**, superseding standard converters whenever OCR is enabled.

---

## 📥 Installation

```bash
npm install markitdown markitdown-ocr
```

---

## 🚀 Usage

### 1. Offline Local OCR (Tesseract.js)

Zero configuration needed — uses local WebAssembly:

```typescript
import { MarkItDown } from "markitdown";
import { registerConverters } from "markitdown-ocr";

const md = new MarkItDown();
registerConverters(md);

// Scanned receipts, invoices, documents
const result = await md.convert("scanned_receipt.jpg");
console.log(result.markdown);
```

### 2. Cloud LLM Vision OCR

Pass your existing OpenAI-compatible client to extract complex formatting and tables:

```typescript
import { MarkItDown } from "markitdown";
import { registerConverters } from "markitdown-ocr";
import OpenAI from "openai";

const client = new OpenAI();
const md = new MarkItDown({
  llmClient: client,
  llmModel: "gpt-4o",
  llmPrompt: "Extract all text and data tables, preserving original markdown table layout.",
});

// Pass client options to the OCR plugin
registerConverters(md, {
  llmClient: client,
  llmModel: "gpt-4o",
});

const result = await md.convert("scanned_financial_report.pdf");
console.log(result.markdown);
```

### 3. Automatic Plugin Discovery

If you have `markitdown-ocr` installed in your project:

```typescript
import { MarkItDown } from "markitdown";

// Automatically discovers and activates markitdown-ocr
const md = new MarkItDown({ enablePlugins: true });

const result = await md.convert("receipt.png");
console.log(result.markdown);
```

### 4. CLI Usage

Enable the OCR plugin using `-p` or `--use-plugins`:

```bash
# Convert scanned document using installed OCR plugin
npx markitdown -p scanned_invoice.png

# Convert scanned PDF
npx markitdown -p scanned_contract.pdf -o output.md
```

---

## 🛠️ Direct OCR Service API

You can also use the OCR services directly in your own applications:

```typescript
import { TesseractOCRService, LLMVisionOCRService } from "markitdown-ocr";
import * as fs from "node:fs";

// Local Tesseract service
const tesseract = new TesseractOCRService("eng");
const buffer = fs.readFileSync("page.png");
const res = await tesseract.extractText(buffer);
console.log(res.text, res.confidence);

// Terminate worker when finished
await tesseract.terminate();
```

---

## 📄 License

MIT © [Microsoft Corporation](https://github.com/microsoft/markitdown) and contributors.
