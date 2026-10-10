import { KanClient } from '../client.js';
import type { Tool } from './workspace.js';
import { ToolResult } from '../types.js';
import { success, error } from '../utils.js';

interface ServerHealthOutput {
  status: 'ok' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  apiReachable: boolean;
  apiLatencyMs?: number;
  error?: string;
}

export const serverHealthTool: Tool<object, ServerHealthOutput> = {
  name: 'server.health',
  description: 'Check the health status of the MCP server and its dependencies',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  handler: async (client: KanClient): Promise<ToolResult<ServerHealthOutput>> => {
    try {
      const startTime = Date.now();
      const healthCheckPath = '/workspaces?limit=1';
      
      let apiReachable = false;
      let apiLatencyMs: number | undefined;
      let errorMessage: string | undefined;

      try {
        await client.request(healthCheckPath, { timeout: 5000, retries: 0 });
        apiReachable = true;
        apiLatencyMs = Date.now() - startTime;
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : String(err);
      }

      let status: ServerHealthOutput['status'] = 'ok';
      if (!apiReachable) {
        status = 'unhealthy';
      } else if (apiLatencyMs !== undefined && apiLatencyMs > 2000) {
        status = 'degraded';
      }

      const result: ServerHealthOutput = {
        status,
        timestamp: new Date().toISOString(),
        version: '0.1.0',
        apiReachable,
      };

      if (apiLatencyMs !== undefined) {
        result.apiLatencyMs = apiLatencyMs;
      }
      if (errorMessage !== undefined) {
        result.error = errorMessage;
      }

      return success(result);
    } catch (err) {
      return error(err instanceof Error ? err.message : 'Health check failed');
    }
  },
};