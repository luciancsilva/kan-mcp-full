#!/usr/bin/env bun
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { KanClient } from './client.js';
import { toMcpError } from './errors.js';
import { createKanServer } from './server.js';
import { startHttpServer } from './http.js';

const apiKey = process.env.KAN_API_KEY;
if (!apiKey) {
  console.error('KAN_API_KEY environment variable is required');
  process.exit(1);
}

const client = new KanClient(apiKey);
const transportKind = (process.env.MCP_TRANSPORT ?? 'stdio').toLowerCase();

if (transportKind === 'http') {
  const token = process.env.MCP_AUTH_TOKEN;
  if (!token) {
    console.error('MCP_AUTH_TOKEN environment variable is required when MCP_TRANSPORT=http');
    process.exit(1);
  }
  try {
    const port = Number(process.env.MCP_PORT ?? 3333);
    const http = startHttpServer({
      client,
      token,
      host: process.env.MCP_HOST ?? '127.0.0.1',
      port,
    });
    console.error(`kan-mcp-full listening on http://${http.hostname}:${http.port}/mcp`);
    const shutdown = () => {
      console.error('Shutting down gracefully...');
      void http.stop().finally(() => process.exit(0));
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('Server error:', toMcpError(error).message);
    process.exit(1);
  }
} else if (transportKind === 'stdio') {
  createKanServer(client)
    .connect(new StdioServerTransport())
    .catch((error) => {
      console.error('Server error:', toMcpError(error).message);
      process.exit(1);
    });
  const shutdown = () => {
    console.error('Shutting down gracefully...');
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} else {
  console.error(`Unknown MCP_TRANSPORT "${transportKind}" (use "stdio" or "http")`);
  process.exit(1);
}
