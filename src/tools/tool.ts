import { KanClient } from '../client';
import { ToolResult } from '../types';
import { success, error } from '../utils';
import { toMcpError } from '../errors';

export interface Tool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
  handler: (client: KanClient, input: TInput) => Promise<ToolResult<TOutput>>;
}

interface ToolSpec<TInput, TOutput> {
  name: string;
  description: string;
  properties: Record<string, unknown>;
  required?: string[];
  run: (client: KanClient, input: TInput) => Promise<TOutput>;
}

/** Builds a tool whose handler turns any thrown error into a ToolResult error. */
export function defineTool<TInput, TOutput>(spec: ToolSpec<TInput, TOutput>): Tool<TInput, TOutput> {
  return {
    name: spec.name,
    description: spec.description,
    inputSchema: { type: 'object', properties: spec.properties, required: spec.required ?? [] },
    handler: async (client, input) => {
      try {
        return success(await spec.run(client, input ?? ({} as TInput)));
      } catch (err) {
        return error(toMcpError(err).message);
      }
    },
  };
}

/** Kan's REST layer rejects a single value for array query params, so a lone value is sent twice. */
export function appendArray(params: URLSearchParams, key: string, values?: string[]): void {
  if (!values?.length) return;
  const list = values.length === 1 ? [values[0] as string, values[0] as string] : values;
  for (const v of list) params.append(key, v);
}

export function withQuery(path: string, params: URLSearchParams): string {
  const q = params.toString();
  return q ? `${path}?${q}` : path;
}
