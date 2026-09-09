/**
 * MarkItDown MCP Server
 * TypeScript port of Python's markitdown-mcp server.
 *
 * Exposes a single `convert_to_markdown` tool via the Model Context Protocol.
 * Supports STDIO transport (default) or Streamable HTTP via --http flag.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { MarkItDown } from "markitdown";

const TOOL_NAME = "convert_to_markdown";

function createServer(): Server {
  const server = new Server(
    {
      name: "markitdown",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Register available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: TOOL_NAME,
          description:
            "Convert a resource described by an http:, https:, file: or data: URI to Markdown",
          inputSchema: {
            type: "object" as const,
            properties: {
              uri: {
                type: "string",
                description:
                  "The URI to convert. Supports http:, https:, file:, and data: schemes.",
              },
            },
            required: ["uri"],
          },
        },
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== TOOL_NAME) {
      throw new Error(`Unknown tool: ${request.params.name}`);
    }

    const uri = request.params.arguments?.uri;
    if (typeof uri !== "string") {
      throw new Error("Missing required argument: uri");
    }

    const enablePlugins =
      process.env.MARKITDOWN_ENABLE_PLUGINS?.trim().toLowerCase() === "true" ||
      process.env.MARKITDOWN_ENABLE_PLUGINS === "1" ||
      process.env.MARKITDOWN_ENABLE_PLUGINS?.trim().toLowerCase() === "yes";

    const markitdown = new MarkItDown({ enablePlugins });

    try {
      const result = await markitdown.convertUri(uri);
      return {
        content: [
          {
            type: "text",
            text: result.markdown,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error converting ${uri}: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

async function main() {
  const args = process.argv.slice(2);
  const useHttp = args.includes("--http") || args.includes("--sse");

  if (useHttp) {
    console.error(
      "HTTP/SSE transport is not yet implemented in the TypeScript version.\n" +
        "Use STDIO transport (default) for now.",
    );
    process.exit(1);
  }

  // STDIO transport (default)
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MarkItDown MCP server running on STDIO");
}

main().catch((error) => {
  console.error(`Fatal error: ${error.message}`);
  process.exit(1);
});

export { createServer };
