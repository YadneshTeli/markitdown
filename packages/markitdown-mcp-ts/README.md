# markitdown-mcp

> Model Context Protocol (MCP) server for MarkItDown TypeScript.

[![npm](https://img.shields.io/npm/v/markitdown-mcp.svg)](https://www.npmjs.com/package/markitdown-mcp)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🌟 Overview

The `markitdown-mcp` package provides an official [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server implementation for MarkItDown in Node.js. It enables AI assistants (such as Claude Desktop, Cursor, Antigravity IDE, and other MCP clients) to convert diverse document formats directly into clean Markdown.

### Exposed Tools

- `convert_to_markdown`: Converts any document or webpage to Markdown.
  - Parameter: `uri` (string) — A valid `file://`, `http://`, `https://`, or `data:` URI.

---

## 📥 Installation

```bash
npm install -g markitdown-mcp
```

Or run directly without installation:

```bash
npx markitdown-mcp
```

---

## ⚙️ Configuration & Client Integrations

### Claude Desktop

Edit your `claude_desktop_config.json`:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "markitdown": {
      "command": "npx",
      "args": ["-y", "markitdown-mcp"]
    }
  }
}
```

### Cursor IDE

Add to your `.cursor/mcp.json` or Cursor settings:

```json
{
  "mcpServers": {
    "markitdown": {
      "command": "npx",
      "args": ["-y", "markitdown-mcp"]
    }
  }
}
```

### Antigravity IDE

Add to your workspace `.agents/mcp_config.json` or global configuration:

```json
{
  "mcpServers": {
    "markitdown": {
      "command": "npx",
      "args": ["-y", "markitdown-mcp"]
    }
  }
}
```

---

## 🔒 Security Considerations

The MCP server operates locally with the permissions of the running process. When processing untrusted user input, ensure file URIs and network requests conform to your security policy.

---

## 📄 License

MIT © [Microsoft Corporation](https://github.com/microsoft/markitdown) and contributors.
