/**
 * URI utilities — TypeScript port of Python's `_uri_utils.py`.
 */
import { URL } from "node:url";
import * as path from "node:path";

/**
 * Convert a file:// URI to a local file path.
 * Returns [netloc, absolutePath].
 */
export function fileUriToPath(fileUri: string): [string | null, string] {
  const parsed = new URL(fileUri);

  if (parsed.protocol !== "file:") {
    throw new Error(`Not a file URL: ${fileUri}`);
  }

  const netloc = parsed.hostname || null;

  // URL.pathname includes the leading slash; on Windows, strip it before the drive letter
  let filePath = decodeURIComponent(parsed.pathname);
  if (process.platform === "win32" && /^\/[A-Za-z]:/.test(filePath)) {
    filePath = filePath.slice(1);
  }

  filePath = path.resolve(filePath);
  return [netloc, filePath];
}

/**
 * Parse a data: URI into its components.
 * Returns [mimeType, attributes, content].
 */
export function parseDataUri(
  uri: string,
): [string | null, Record<string, string>, Buffer] {
  if (!uri.toLowerCase().startsWith("data:")) {
    throw new Error("Not a data URI");
  }

  const commaIndex = uri.indexOf(",");
  if (commaIndex === -1) {
    throw new Error("Malformed data URI, missing ',' separator");
  }

  const header = uri.slice(5, commaIndex); // Strip 'data:'
  const data = uri.slice(commaIndex + 1);

  const parts = header.split(";");

  let isBase64 = false;
  if (parts.length > 0 && parts[parts.length - 1].toLowerCase() === "base64") {
    parts.pop();
    isBase64 = true;
  }

  let mimeType: string | null = null;
  if (parts.length > 0 && parts[0].length > 0) {
    mimeType = parts.shift()!;
  }

  const attributes: Record<string, string> = {};
  for (const part of parts) {
    if (part.includes("=")) {
      const [key, value] = part.split("=", 2);
      attributes[key.toLowerCase()] = value;
    } else if (part.length > 0) {
      attributes[part.toLowerCase()] = "";
    }
  }

  const content = isBase64
    ? Buffer.from(data, "base64")
    : Buffer.from(decodeURIComponent(data), "utf-8");

  return [mimeType, attributes, content];
}
