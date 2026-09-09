/**
 * Example: Plugins and OCR in TypeScript
 *
 * Demonstrates using the markitdown-ocr plugin with local Tesseract.js (offline Wasm)
 * and third-party plugins.
 *
 * Run with: npx tsx examples/typescript/plugin-and-ocr.ts
 */
import { MarkItDown } from "markitdown";
import { registerConverters as registerOcrConverters } from "markitdown-ocr";

async function main() {
  console.log("=== MarkItDown Plugins & OCR Examples ===\n");

  // 1. List all installed MarkItDown plugins
  console.log("Discovered 3rd-party plugins:");
  const plugins = MarkItDown.listPlugins();
  for (const p of plugins) {
    console.log(` - ${p.name} (v${p.version || "unknown"}): ${p.description || "No description"}`);
  }
  console.log();

  // 2. Initialize MarkItDown with automatic plugin discovery
  const mdAuto = new MarkItDown({ enablePlugins: true });
  console.log("MarkItDown initialized with automatic plugin loading.");

  // 3. Explicit OCR plugin registration
  const mdOcr = new MarkItDown();
  registerOcrConverters(mdOcr);
  console.log("MarkItDown registered with Tesseract.js local OCR converters at priority -1.0.");
}

main().catch(console.error);
