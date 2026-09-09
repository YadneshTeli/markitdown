import type { StreamInfo } from "markitdown";

export interface OCRResult {
  text: string;
  confidence?: number;
  backendUsed?: string;
  error?: string;
}

export interface OCRService {
  extractText(
    imageStream: Buffer,
    prompt?: string,
    streamInfo?: StreamInfo,
  ): Promise<OCRResult>;
}
