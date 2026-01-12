// packages/fal/src/client.ts

import { sleep } from '@varg/sdk';

export interface FalClientConfig {
  apiKey?: string;
  baseURL?: string;
  timeout?: number;
}

const DEFAULTS = {
  apiKey: process.env.FAL_KEY ?? '',
  baseURL: 'https://queue.fal.run',
  timeout: 180,
};

export function createFalClient(config: FalClientConfig = {}) {
  const apiKey = config.apiKey ?? DEFAULTS.apiKey;
  const baseURL = config.baseURL ?? DEFAULTS.baseURL;
  const timeout = config.timeout ?? DEFAULTS.timeout;

  if (!apiKey) throw new Error('FAL_KEY required');

  const headers = { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' };

  async function run<T = unknown>(endpoint: string, params: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${baseURL}/${endpoint}`, {
      method: 'POST', headers, body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`Fal submit failed: ${res.status}`);
    const { request_id } = await res.json() as { request_id?: string };
    if (!request_id) throw new Error('No request_id');
    return poll<T>(endpoint, request_id);
  }

  async function poll<T>(endpoint: string, requestId: string): Promise<T> {
    for (let i = 0; i < timeout; i++) {
      const res = await fetch(`${baseURL}/${endpoint}/requests/${requestId}`, { headers });
      if (!res.ok) throw new Error(`Poll failed: ${res.status}`);
      const data = await res.json() as { status: string; result?: T; error?: string };
      if (data.status === 'completed') return data.result as T;
      if (data.status === 'failed') throw new Error(data.error ?? 'Failed');
      await sleep(1000);
    }
    throw new Error(`Timeout after ${timeout}s`);
  }

  return { run, poll, config: { baseURL, timeout } };
}

let _client: ReturnType<typeof createFalClient> | null = null;
export function getFalClient() {
  if (!_client) _client = createFalClient();
  return _client;
}
