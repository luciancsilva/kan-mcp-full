import { afterEach, beforeEach } from 'bun:test';
import { KanClient } from '../src/client';
import { tools } from '../src/tools/mod';

export const BASE = 'https://kan.test/api/v1';

export interface Call {
  method: string;
  path: string; // path + query, relative to the API base
  body: any;
}

type Reply = unknown | Response;

/** Installs a fetch mock for the duration of each test and records every request to the Kan API. */
export function useKanMock() {
  const state = {
    calls: [] as Call[],
    handler: (_call: Call): Reply => ({}),
  };
  let original: typeof fetch;

  beforeEach(() => {
    original = globalThis.fetch;
    state.calls = [];
    state.handler = () => ({});
    globalThis.fetch = (async (input: unknown, init: RequestInit = {}) => {
      const url = String(input);
      const call: Call = {
        method: init.method ?? 'GET',
        path: url.startsWith(BASE) ? url.slice(BASE.length) : url,
        body: typeof init.body === 'string' ? JSON.parse(init.body) : init.body,
      };
      state.calls.push(call);
      const reply = state.handler(call);
      return reply instanceof Response
        ? reply
        : new Response(JSON.stringify(reply), { headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = original;
  });

  return state;
}

export const client = () => new KanClient('test-key', BASE, 5000, 0);

export const tool = (name: string) => {
  const found = tools.find((t: { name: string }) => t.name === name);
  if (!found) throw new Error(`unknown tool ${name}`);
  return found;
};

export async function run(name: string, input: object = {}) {
  return tool(name).handler(client(), input);
}

export function errorReply(status: number, message: string, fieldErrors?: Record<string, string[]>) {
  return new Response(
    JSON.stringify({ message, code: 'X', data: { zodError: fieldErrors ? { fieldErrors } : null } }),
    { status, statusText: status === 404 ? 'Not Found' : 'Bad Request', headers: { 'content-type': 'application/json' } }
  );
}
