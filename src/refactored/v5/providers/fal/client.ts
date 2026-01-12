export interface FalClientConfig {
    apiKey?: string;
    baseURL?: string;
    timeout?: number;  // seconds
  }
  
  export interface FalResult<T = unknown> {
    status: string;
    data: T;
  }
  
  const DEFAULT_CONFIG: Required<FalClientConfig> = {
    apiKey: process.env.FAL_KEY ?? '',
    baseURL: 'https://queue.fal.run',
    timeout: 180,  // 3 minutes
  };
  
  export function createFalClient(config: FalClientConfig = {}) {
    const { apiKey, baseURL, timeout } = { ...DEFAULT_CONFIG, ...config };
  
    if (!apiKey) {
      throw new Error('FAL_KEY is required');
    }
  
    const headers = {
      'Authorization': `Key ${apiKey}`,
      'Content-Type': 'application/json',
    };
  
    async function run<T = unknown>(endpoint: string, params: Record<string, unknown>): Promise<T> {
      // 1. Submit to queue
      const response = await fetch(`${baseURL}/${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
      });
  
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Fal request failed: ${response.status} ${error}`);
      }
  
      const data = await response.json() as { request_id?: string };
  
      if (!data.request_id) {
        throw new Error('No request_id in response');
      }
  
      // 2. Poll for result
      return poll<T>(endpoint, data.request_id);
    }
  
    async function poll<T>(endpoint: string, requestId: string): Promise<T> {
      const maxAttempts = timeout;
  
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const response = await fetch(
          `${baseURL}/${endpoint}/requests/${requestId}`,
          { headers }
        );
  
        if (!response.ok) {
          throw new Error(`Poll failed: ${response.status}`);
        }
  
        const data = await response.json() as { 
          status: string; 
          result?: T;
          error?: string;
        };
  
        if (data.status === 'completed') {
          return data.result as T;
        }
  
        if (data.status === 'failed') {
          throw new Error(data.error ?? 'Generation failed');
        }
  
        // IN_PROGRESS, IN_QUEUE — keep polling
        await sleep(1000);
      }
  
      throw new Error(`Timeout after ${timeout}s waiting for fal response`);
    }
  
    return { run, poll };
  }
  
  function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Default client instance
  export const falClient = createFalClient();