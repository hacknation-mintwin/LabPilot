import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { createSimilaritySearchClient } from "./search-client.js";

const TOOL_NAME = "search_similar_experiments";
const TOOL_DESCRIPTION =
  "Searches the LabPilot onepager backend and returns top similar AI/ML experiments with scores.";

function toTextContent(payload) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

function createServer() {
  const client = createSimilaritySearchClient();
  const server = new Server(
    { name: "similarity-search-mcp-server", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: TOOL_NAME,
        description: TOOL_DESCRIPTION,
        inputSchema: {
          type: "object",
          additionalProperties: false,
          required: ["prompt"],
          properties: {
            prompt: {
              type: "string",
              description: "Experiment description to search against prior literature.",
            },
            topK: {
              type: "integer",
              minimum: 1,
              maximum: 10,
              default: 10,
              description: "How many top results to return.",
            },
          },
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== TOOL_NAME) {
      throw new Error(`Unknown tool: ${request.params.name}`);
    }

    const args = request.params.arguments || {};
    const prompt = args.prompt;
    const topK = args.topK ?? 10;

    const result = await client.search({ prompt, topK });
    return toTextContent(result);
  });

  return server;
}

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Failed to start similarity-search MCP server:", error);
  process.exitCode = 1;
});

export { createServer, TOOL_DESCRIPTION, TOOL_NAME };
