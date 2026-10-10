#!/usr/bin/env bun
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { KanClient } from "./client.js";
import { toMcpError } from "./errors.js";
import { tools, type Tool } from "./tools/mod.js";
import { resourceList, handleResource } from "./tools/resources.js";

const apiKey = process.env.KAN_API_KEY;
if (!apiKey) {
  console.error("KAN_API_KEY environment variable is required");
  process.exit(1);
}

const client = new KanClient(apiKey);

const server = new Server(
  { name: "kan-mcp", version: "0.1.0" },
  { capabilities: { tools: {}, resources: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: tools.map((tool: Tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  };
});

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: resourceList.map(r => ({
    uri: r.uri,
    name: r.name,
    description: r.description,
    mimeType: r.mimeType,
  })),
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  try {
    return await handleResource(uri, client);
  } catch (error) {
    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({ error: toMcpError(error).message }),
      }],
      isError: true,
    };
  }
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  const tool = tools.find((t: Tool) => t.name === name);
  if (!tool) {
    return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
  }
  try {
    const result = await tool.handler(client, args);
    if (result.ok) {
      return { content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }] };
    } else {
      return { content: [{ type: "text", text: result.error }], isError: true };
    }
  } catch (error) {
    return { content: [{ type: "text", text: toMcpError(error).message }], isError: true };
  }
});

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: resourceList.map(r => ({
    uri: r.uri,
    name: r.name,
    description: r.description,
    mimeType: r.mimeType,
  })),
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  try {
    return await handleResource(uri, client);
  } catch (error) {
    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({ error: toMcpError(error).message }),
      }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
server.connect(transport).catch((error) => {
  console.error("Server error:", toMcpError(error).message);
  process.exit(1);
});

const shutdown = () => {
  console.error("Shutting down gracefully...");
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
