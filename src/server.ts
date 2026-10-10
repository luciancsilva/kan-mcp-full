import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { KanClient } from './client.js';
import { toMcpError } from './errors.js';
import { VERSION } from './version.js';
import { tools, type Tool } from './tools/mod.js';
import { resourceList, handleResource } from './tools/resources.js';

/** Builds an MCP server with all Kan tools and resources, bound to the given Kan client. */
export function createKanServer(client: KanClient): Server {
  const server = new Server(
    { name: 'kan-mcp-full', version: VERSION },
    { capabilities: { tools: {}, resources: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((tool: Tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  }));

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: resourceList.map((r) => ({
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
        contents: [{ uri, mimeType: 'application/json', text: JSON.stringify({ error: toMcpError(error).message }) }],
        isError: true,
      };
    }
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    const tool = tools.find((t: Tool) => t.name === name);
    if (!tool) {
      return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }
    try {
      const result = await tool.handler(client, args);
      if (result.ok) {
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
      }
      return { content: [{ type: 'text', text: result.error }], isError: true };
    } catch (error) {
      return { content: [{ type: 'text', text: toMcpError(error).message }], isError: true };
    }
  });

  return server;
}
