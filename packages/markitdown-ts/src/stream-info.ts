/**
 * StreamInfo — metadata about a file stream.
 *
 * All fields are optional and depend on how the stream was opened.
 * This is the TypeScript port of Python's `_stream_info.py`.
 */
export interface StreamInfo {
  /** MIME type of the stream (e.g., "application/pdf") */
  readonly mimetype?: string;
  /** File extension including the dot (e.g., ".pdf") */
  readonly extension?: string;
  /** Character encoding (e.g., "utf-8") */
  readonly charset?: string;
  /** Original filename (from local path, URL, or Content-Disposition) */
  readonly filename?: string;
  /** Local filesystem path, if read from disk */
  readonly localPath?: string;
  /** URL, if read from a remote source */
  readonly url?: string;
}

/**
 * Create a new StreamInfo by merging the base with overrides.
 * Non-undefined values in `overrides` take precedence.
 */
export function copyAndUpdateStreamInfo(
  base: StreamInfo,
  ...overrides: (Partial<StreamInfo> | undefined)[]
): StreamInfo {
  const result: Record<string, string | undefined> = { ...base };

  for (const override of overrides) {
    if (!override) continue;
    for (const [key, value] of Object.entries(override)) {
      if (value !== undefined) {
        result[key] = value;
      }
    }
  }

  return Object.freeze(result) as StreamInfo;
}

/**
 * Create a frozen StreamInfo.
 */
export function createStreamInfo(info: StreamInfo = {}): StreamInfo {
  return Object.freeze({ ...info });
}
