/**
 * MarkItDown CLI — Command-line interface.
 * TypeScript port of Python's `__main__.py`.
 */
import { Command } from "commander";
import * as fs from "node:fs";
import { MarkItDown } from "./markitdown.js";
import type { StreamInfo } from "./stream-info.js";

const VERSION = "0.1.0";

async function main() {
  const program = new Command();

  program
    .name("markitdown")
    .description("Convert various file formats to Markdown.")
    .version(VERSION)
    .argument("[filename]", "File to convert. If omitted, reads from stdin.")
    .option("-o, --output <file>", "Output file. If not provided, writes to stdout.")
    .option(
      "-x, --extension <ext>",
      "Hint about the file extension (e.g., .pdf)",
    )
    .option("-m, --mime-type <type>", "Hint about the file MIME type.")
    .option("-c, --charset <charset>", "Hint about the file charset (e.g., utf-8).")
    .option(
      "-p, --use-plugins",
      "Enable 3rd-party plugins.",
      false,
    )
    .option(
      "--list-plugins",
      "List installed 3rd-party plugins. Plugins are loaded when using the -p or --use-plugins option.",
      false,
    )
    .option(
      "--keep-data-uris",
      "Keep data URIs (like base64-encoded images) in the output.",
      false,
    )
    .parse(process.argv);

  const opts = program.opts();

  if (opts.listPlugins) {
    console.log("Installed MarkItDown 3rd-party Plugins:\n");
    const plugins = MarkItDown.listPlugins();
    if (plugins.length === 0) {
      console.log("  * No 3rd-party plugins installed.\n");
      console.log(
        "Find plugins by searching for the hashtag #markitdown-plugin on GitHub or npm.\n",
      );
    } else {
      for (const p of plugins) {
        console.log(
          `  * ${p.name}${p.version ? ` (${p.version})` : ""}${p.description ? ` - ${p.description}` : ""}`,
        );
      }
      console.log(
        "\nUse the -p (or --use-plugins) option to enable 3rd-party plugins.\n",
      );
    }
    process.exit(0);
  }

  const filename = program.args[0];

  // Parse extension hint
  let extensionHint = opts.extension;
  if (extensionHint) {
    extensionHint = extensionHint.trim().toLowerCase();
    if (extensionHint && !extensionHint.startsWith(".")) {
      extensionHint = "." + extensionHint;
    }
  }

  // Parse MIME type
  let mimeTypeHint = opts.mimeType;
  if (mimeTypeHint) {
    mimeTypeHint = mimeTypeHint.trim();
    if (mimeTypeHint.split("/").length !== 2) {
      console.error(`Invalid MIME type: ${mimeTypeHint}`);
      process.exit(1);
    }
  }

  // Parse charset
  let charsetHint = opts.charset;
  if (charsetHint) {
    charsetHint = charsetHint.trim();
  }

  // Build stream info from hints
  let streamInfo: StreamInfo | undefined;
  if (extensionHint || mimeTypeHint || charsetHint) {
    streamInfo = {
      extension: extensionHint || undefined,
      mimetype: mimeTypeHint || undefined,
      charset: charsetHint || undefined,
    };
  }

  // Create MarkItDown instance
  const markitdown = new MarkItDown({
    enablePlugins: opts.usePlugins,
  });

  let result;

  if (!filename) {
    // Read from stdin
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    result = await markitdown.convertStream(buffer, {
      streamInfo,
      keepDataUris: opts.keepDataUris,
    });
  } else {
    // Convert file
    if (!fs.existsSync(filename)) {
      console.error(`File not found: ${filename}`);
      process.exit(1);
    }

    result = await markitdown.convert(filename, {
      streamInfo,
      keepDataUris: opts.keepDataUris,
    });
  }

  // Output
  if (opts.output) {
    fs.writeFileSync(opts.output, result.markdown, "utf-8");
  } else {
    process.stdout.write(result.markdown + "\n");
  }
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
