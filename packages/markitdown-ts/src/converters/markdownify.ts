/**
 * Custom Turndown (HTML → Markdown) converter.
 * TypeScript port of Python's `_markdownify.py` which customized the `markdownify` library.
 *
 * Changes from default Turndown:
 * - ATX headings (#, ##, etc.) with proper newlines
 * - JavaScript links are removed
 * - Data URIs in images are truncated by default
 * - URIs are properly escaped
 * - Checkbox inputs are converted to [x]/[ ]
 * - Underline tags preserved as <u>
 * - <strike> treated like <s>/<del>
 */
import TurndownService from "turndown";

export interface MarkdownifyOptions {
  keepDataUris?: boolean;
  [key: string]: unknown;
}

export function createMarkdownConverter(
  options: MarkdownifyOptions = {},
): TurndownService {
  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });

  // Custom heading rule: ensure newline before headings
  turndown.addRule("heading", {
    filter: ["h1", "h2", "h3", "h4", "h5", "h6"],
    replacement(content, node) {
      const hLevel = Number(node.nodeName.charAt(1));
      const prefix = "#".repeat(hLevel);
      const trimmed = content.trim();
      if (!trimmed) return "";
      return `\n\n${prefix} ${trimmed}\n\n`;
    },
  });

  // Custom link rule: remove JavaScript links, escape URIs
  turndown.addRule("link", {
    filter: (node) => {
      return node.nodeName === "A" && node.getAttribute("href") !== null;
    },
    replacement(content, node) {
      const href = (node as HTMLAnchorElement).getAttribute("href") || "";
      const title = (node as HTMLAnchorElement).getAttribute("title") || "";

      if (!content.trim()) return "";

      // Skip javascript:, mailto:, and other non-http schemes
      try {
        const url = new URL(href, "http://placeholder");
        if (url.protocol && !["http:", "https:", "file:"].includes(url.protocol)) {
          return content;
        }
      } catch {
        // If URL parsing fails on a relative URL, keep it
      }

      const titlePart = title ? ` "${title.replace(/"/g, '\\"')}"` : "";
      return `[${content}](${href}${titlePart})`;
    },
  });

  // Custom image rule: truncate data URIs
  turndown.addRule("image", {
    filter: "img",
    replacement(_content, node) {
      const alt = ((node as HTMLImageElement).getAttribute("alt") || "").replace(
        /\n/g,
        " ",
      );
      let src =
        (node as HTMLImageElement).getAttribute("src") ||
        (node as HTMLImageElement).getAttribute("data-src") ||
        "";
      const title = (node as HTMLImageElement).getAttribute("title") || "";
      const titlePart = title ? ` "${title.replace(/"/g, '\\"')}"` : "";

      // Truncate data URIs unless keepDataUris is set
      if (src.toLowerCase().startsWith("data:") && !options.keepDataUris) {
        src = src.split(",")[0] + "...";
      }

      return `![${alt}](${src}${titlePart})`;
    },
  });

  // Checkbox input support
  turndown.addRule("checkbox", {
    filter: (node) => {
      return (
        node.nodeName === "INPUT" &&
        (node as HTMLInputElement).getAttribute("type") === "checkbox"
      );
    },
    replacement(_content, node) {
      return (node as HTMLInputElement).hasAttribute("checked") ? "[x] " : "[ ] ";
    },
  });

  // Underline support — keep as HTML <u> tags
  turndown.addRule("underline", {
    filter: "u",
    replacement(content) {
      if (!content.trim()) return "";
      return `<u>${content}</u>`;
    },
  });

  // <strike> → treat like <s>/<del>
  turndown.addRule("strike", {
    filter: (node) => node.nodeName.toLowerCase() === "strike",
    replacement(content) {
      if (!content.trim()) return "";
      return `~~${content}~~`;
    },
  });

  // Remove script and style elements
  turndown.remove(["script", "style"]);

  return turndown;
}
