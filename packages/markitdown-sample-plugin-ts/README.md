# markitdown-sample-plugin

> Sample 3rd-party plugin for MarkItDown TypeScript — demonstrates custom format conversion (RTF).

[![npm](https://img.shields.io/npm/v/markitdown-sample-plugin.svg)](https://www.npmjs.com/package/markitdown-sample-plugin)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🌟 Overview

This package demonstrates how to author, test, and publish third-party plugins for **MarkItDown** in the TypeScript/JavaScript ecosystem. It implements an **RTF (Rich Text Format)** converter.

---

## 🏗️ How to Build a MarkItDown Plugin

### Step 1: Implement your custom `DocumentConverter`

```typescript
import {
  DocumentConverter,
  DocumentConverterResult,
  type ConvertOptions,
  type StreamInfo,
} from "markitdown";

export class RtfConverter extends DocumentConverter {
  accepts(
    fileStream: Buffer,
    streamInfo: StreamInfo,
    options?: ConvertOptions,
  ): boolean {
    const ext = (streamInfo.extension || "").toLowerCase();
    const mime = (streamInfo.mimetype || "").toLowerCase();
    return ext === ".rtf" || mime.startsWith("text/rtf") || mime.startsWith("application/rtf");
  }

  convert(
    fileStream: Buffer,
    streamInfo: StreamInfo,
    options?: ConvertOptions,
  ): DocumentConverterResult {
    const rtfText = fileStream.toString("utf-8");
    // Strip RTF markup and extract clean text...
    const cleanText = rtfText.replace(/\\[a-z]+\d*\s?/gi, "").trim();

    return new DocumentConverterResult({
      markdown: cleanText,
    });
  }
}
```

### Step 2: Export the `registerConverters` Entry Point

Export `registerConverters` and the interface version:

```typescript
import type { MarkItDown } from "markitdown";
import { RtfConverter } from "./rtf-converter.js";

export const PLUGIN_INTERFACE_VERSION = 1;

export function registerConverters(markitdown: MarkItDown, options?: Record<string, unknown>): void {
  // Register your custom converter
  markitdown.registerConverter(new RtfConverter());
}
```

### Step 3: Configure `package.json` for Discovery

Add `"markitdown-plugin"` to your `keywords` and define plugin metadata:

```json
{
  "name": "my-markitdown-plugin",
  "version": "0.1.0",
  "type": "module",
  "keywords": [
    "markitdown",
    "markitdown-plugin"
  ],
  "markitdown-plugin": {
    "interfaceVersion": 1
  }
}
```

---

## 🧪 Testing Your Plugin

Once installed in a project or workspace, verify discovery using the CLI:

```bash
# Verify the plugin is discovered
npx markitdown --list-plugins

# Use the plugin to convert a file
npx markitdown -p my-document.rtf
```

---

## 📄 License

MIT © [Microsoft Corporation](https://github.com/microsoft/markitdown) and contributors.
