/**
 * Custom exception classes — TypeScript port of Python's `_exceptions.py`.
 */

/**
 * Base exception class for MarkItDown.
 */
export class MarkItDownError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "MarkItDownError";
  }
}

/**
 * Thrown when a converter's required dependency is not installed.
 * This is not necessarily fatal — the converter will be skipped
 * and an error will bubble up only if no other suitable converter is found.
 */
export class MissingDependencyError extends MarkItDownError {
  constructor(message?: string) {
    super(message);
    this.name = "MissingDependencyError";
  }
}

/**
 * Thrown when no suitable converter was found for the given file.
 */
export class UnsupportedFormatError extends MarkItDownError {
  constructor(message?: string) {
    super(message);
    this.name = "UnsupportedFormatError";
  }
}

/**
 * Represents a single failed attempt to convert a file.
 */
export interface FailedConversionAttempt {
  converterName: string;
  error?: Error;
}

/**
 * Thrown when a suitable converter was found, but the conversion process fails.
 */
export class FileConversionError extends MarkItDownError {
  public attempts?: FailedConversionAttempt[];

  constructor(
    message?: string,
    attempts?: FailedConversionAttempt[],
  ) {
    if (!message) {
      if (!attempts || attempts.length === 0) {
        message = "File conversion failed.";
      } else {
        message = `File conversion failed after ${attempts.length} attempts:\n`;
        for (const attempt of attempts) {
          if (!attempt.error) {
            message += `  - ${attempt.converterName} provided no error info.\n`;
          } else {
            message += `  - ${attempt.converterName} threw ${attempt.error.name}: ${attempt.error.message}\n`;
          }
        }
      }
    }
    super(message);
    this.name = "FileConversionError";
    this.attempts = attempts;
  }
}

/**
 * Helper to build a "missing dependency" message matching the Python original's format.
 */
export function buildMissingDependencyMessage(
  converterName: string,
  extension: string,
  packageName: string,
): string {
  return (
    `${converterName} recognized the input as a potential ${extension} file, ` +
    `but the dependency needed to read ${extension} files is not installed. ` +
    `To resolve this error, install the required package:\n\n` +
    `  npm install ${packageName}\n`
  );
}
