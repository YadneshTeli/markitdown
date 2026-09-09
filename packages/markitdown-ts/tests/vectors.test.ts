import { describe, it, expect } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs";
import { MarkItDown } from "../src/markitdown.js";
import { createStreamInfo } from "../src/stream-info.js";

const TEST_FILES_DIR = path.resolve(__dirname, "../../markitdown/tests/test_files");

describe("MarkItDown General Test Vectors", () => {
  const markitdown = new MarkItDown();

  it("converts DOCX files correctly", async () => {
    const file = path.join(TEST_FILES_DIR, "test.docx");
    const result = await markitdown.convert(file);

    expect(result.markdown).toContain("314b0a30-5b04-470b-b9f7-eed2c2bec74a");
    expect(result.markdown).toContain("49e168b7-d2ae-407f-a055-2167576f39a1");
    expect(result.markdown).toContain("## d666f1f7-46cb-42bd-9a39-9a39cf2a509f");
    expect(result.markdown).toContain("# Abstract");
    expect(result.markdown).toContain("# Introduction");
    expect(result.markdown).toContain(
      "AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation",
    );
    expect(result.markdown).toContain("data:image/png;base64...");
    expect(result.markdown).not.toContain("data:image/png;base64,iVBORw0KGgoAAASU");
  });

  it("converts XLSX files correctly", async () => {
    const file = path.join(TEST_FILES_DIR, "test.xlsx");
    const result = await markitdown.convert(file);

    expect(result.markdown).toContain("## 09060124-b5e7-4717-9d07-3c046eb");
    expect(result.markdown).toContain("6ff4173b-42a5-4784-9b19-f49caff4d93d");
    expect(result.markdown).toContain("affc7dad-52dc-4b98-9b5d-51e65d8a8ad0");
  });

  it("converts legacy XLS files correctly", async () => {
    const file = path.join(TEST_FILES_DIR, "test.xls");
    const result = await markitdown.convert(file);

    expect(result.markdown).toContain("## 09060124-b5e7-4717-9d07-3c046eb");
    expect(result.markdown).toContain("6ff4173b-42a5-4784-9b19-f49caff4d93d");
    expect(result.markdown).toContain("affc7dad-52dc-4b98-9b5d-51e65d8a8ad0");
  });

  it("converts PPTX files correctly", async () => {
    const file = path.join(TEST_FILES_DIR, "test.pptx");
    const result = await markitdown.convert(file);

    expect(result.markdown).toContain("2cdda5c8-e50e-4db4-b5f0-9722a649f455");
    expect(result.markdown).toContain("04191ea8-5c73-4215-a1d3-1cfb43aaaf12");
    expect(result.markdown).toContain("1b92870d-e3b5-4e65-8153-919f4ff45592");
    expect(result.markdown).toContain(
      "AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation",
    );
  });

  it("converts PDF files correctly", async () => {
    const file = path.join(TEST_FILES_DIR, "test.pdf");
    const result = await markitdown.convert(file);

    expect(result.markdown).toContain(
      "While there is contemporaneous exploration of multi-agent approaches",
    );
  });

  it("converts HTML blog pages correctly", async () => {
    const file = path.join(TEST_FILES_DIR, "test_blog.html");
    const result = await markitdown.convert(file);

    expect(result.markdown).toContain(
      "Large language models (LLMs) are powerful tools that can generate natural language texts for various applications",
    );
    expect(result.markdown).toContain(
      "an example where high cost can easily prevent a generic complex",
    );
  });

  it("converts Wikipedia pages with URL context", async () => {
    const file = path.join(TEST_FILES_DIR, "test_wikipedia.html");
    const result = await markitdown.convert(file, {
      streamInfo: createStreamInfo({
        url: "https://en.wikipedia.org/wiki/Microsoft",
      }),
    });

    expect(result.markdown).toContain(
      "Microsoft entered the operating system (OS) business in 1980 with its own version of [Unix]",
    );
    expect(result.markdown).toContain("Bill Gates");
    expect(result.markdown).not.toContain(
      "You are encouraged to create an account and log in",
    );
  });

  it("converts Bing SERP pages with URL context", async () => {
    const file = path.join(TEST_FILES_DIR, "test_serp.html");
    const result = await markitdown.convert(file, {
      streamInfo: createStreamInfo({
        url: "https://www.bing.com/search?q=microsoft+wikipedia",
      }),
    });

    expect(result.markdown).toContain("https://en.wikipedia.org/wiki/Microsoft");
    expect(result.markdown).toContain(
      "Microsoft Corporation is **an American multinational corporation and technology company headquartered** in Redmond",
    );
    expect(result.markdown).toContain(
      "1995–2007: Foray into the Web, Windows 95, Windows XP, and Xbox",
    );
    expect(result.markdown).not.toContain("https://www.bing.com/ck/a?!&&p=");
  });

  it("converts CSV files with charset hints (CP932)", async () => {
    const file = path.join(TEST_FILES_DIR, "test_mskanji.csv");
    const result = await markitdown.convert(file, {
      streamInfo: createStreamInfo({
        charset: "cp932",
        mimetype: "text/csv",
      }),
    });

    expect(result.markdown).toContain("| 名前 | 年齢 | 住所 |");
    expect(result.markdown).toContain("| 佐藤太郎 | 30 | 東京 |");
    expect(result.markdown).toContain("| 三木英子 | 25 | 大阪 |");
    expect(result.markdown).toContain("| 髙橋淳 | 35 | 名古屋 |");
  });

  it("converts JSON files correctly", async () => {
    const file = path.join(TEST_FILES_DIR, "test.json");
    const result = await markitdown.convert(file);

    expect(result.markdown).toContain("5b64c88c-b3c3-4510-bcb8-da0b200602d8");
    expect(result.markdown).toContain("9700dc99-6685-40b4-9a3a-5e406dcb37f3");
  });

  it("converts RSS XML feeds correctly", async () => {
    const file = path.join(TEST_FILES_DIR, "test_rss.xml");
    const result = await markitdown.convert(file);

    expect(result.markdown).toContain("# The Official Microsoft Blog");
    expect(result.markdown).toContain(
      "## Ignite 2024: Why nearly 70% of the Fortune 500 now use Microsoft 365 Copilot",
    );
    expect(result.markdown).toContain(
      "In the case of AI, it is absolutely true that the industry is moving incredibly fast",
    );
    expect(result.markdown).not.toContain("<rss");
    expect(result.markdown).not.toContain("<feed");
  });

  it("converts Jupyter Notebooks correctly", async () => {
    const file = path.join(TEST_FILES_DIR, "test_notebook.ipynb");
    const result = await markitdown.convert(file);

    expect(result.markdown).toContain("# Test Notebook");
    expect(result.markdown).toContain("```python");
    expect(result.markdown).toContain('print("markitdown")');
    expect(result.markdown).toContain("## Code Cell Below");
    expect(result.markdown).not.toContain("nbformat");
  });

  it("converts ZIP archives recursively", async () => {
    const file = path.join(TEST_FILES_DIR, "test_files.zip");
    const result = await markitdown.convert(file);

    expect(result.markdown).toContain("314b0a30-5b04-470b-b9f7-eed2c2bec74a");
    expect(result.markdown).toContain("49e168b7-d2ae-407f-a055-2167576f39a1");
    expect(result.markdown).toContain("## 09060124-b5e7-4717-9d07-3c046eb");
    expect(result.markdown).toContain("6ff4173b-42a5-4784-9b19-f49caff4d93d");
  });

  it("converts EPUB books correctly", async () => {
    const file = path.join(TEST_FILES_DIR, "test.epub");
    const result = await markitdown.convert(file);

    expect(result.markdown).toContain("**Authors:** Test Author");
    expect(result.markdown).toContain(
      "A test EPUB document for MarkItDown testing",
    );
    expect(result.markdown).toContain("# Chapter 1: Test Content");
    expect(result.markdown).toContain(
      "This is a **test** paragraph with some formatting",
    );
    expect(result.markdown).toContain("A bullet point");
    expect(result.markdown).toContain("Another point");
    expect(result.markdown).toContain("# Chapter 2: More Content");
    expect(result.markdown).toContain("> This is a blockquote for testing");
  });

  it("extracts EXIF metadata from JPEG images", async () => {
    const file = path.join(TEST_FILES_DIR, "test.jpg");
    const result = await markitdown.convert(file);

    expect(result.markdown).toContain("Author: AutoGen Authors");
    expect(result.markdown).toContain("DateTimeOriginal: 2024:03:14 22:10:00");
  });

  it("extracts audio metadata from WAV and MP3", async () => {
    const wavFile = path.join(TEST_FILES_DIR, "test.wav");
    const wavResult = await markitdown.convert(wavFile);
    expect(wavResult.markdown).toContain("Duration:");
    expect(wavResult.markdown).toContain("Channels: 2");

    const mp3File = path.join(TEST_FILES_DIR, "test.mp3");
    const mp3Result = await markitdown.convert(mp3File);
    expect(mp3Result.markdown).toContain(
      "Title: f67a499e-a7d0-4ca3-a49b-358bd934ae3e",
    );
    expect(mp3Result.markdown).toContain("Artist: Artist Name Test String");
  });
});
