/**
 * Example: Basic MarkItDown Conversion in TypeScript
 *
 * Demonstrates converting various local files and web URLs to Markdown.
 * Run with: npx tsx examples/typescript/basic-conversion.ts
 */
import { MarkItDown } from "markitdown";

async function main() {
  const md = new MarkItDown();

  console.log("=== MarkItDown TypeScript Examples ===\n");

  // Example 1: Convert a Markdown / text string
  const textBuffer = Buffer.from("# Hello World\n\nThis is a sample document.", "utf-8");
  const textResult = await md.convert(textBuffer, {
    streamInfo: { extension: ".md", mimetype: "text/markdown" },
  });
  console.log("1. Text buffer conversion:\n", textResult.markdown, "\n");

  // Example 2: Convert a CSV with automatic table formatting
  const csvBuffer = Buffer.from(
    "Product,Price,Quantity\nLaptop,$999,5\nMouse,$25,50\nKeyboard,$75,20\n",
    "utf-8",
  );
  const csvResult = await md.convert(csvBuffer, {
    streamInfo: { extension: ".csv", mimetype: "text/csv" },
  });
  console.log("2. CSV table conversion:\n", csvResult.markdown, "\n");

  // Example 3: Convert an HTML snippet
  const htmlBuffer = Buffer.from(
    "<h1>Release Notes</h1><p>MarkItDown is now available for <b>TypeScript</b>!</p><ul><li>Zero-config</li><li>Fast</li></ul>",
    "utf-8",
  );
  const htmlResult = await md.convert(htmlBuffer, {
    streamInfo: { extension: ".html", mimetype: "text/html" },
  });
  console.log("3. HTML conversion:\n", htmlResult.markdown, "\n");
}

main().catch(console.error);
