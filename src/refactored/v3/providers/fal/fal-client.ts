// Fal.ai HTTP Client

export interface FalConfig {
  apiKey?: string
  baseUrl?: string
  /** Polling interval in ms (default: 1000) */
  pollInterval?: number
  /** Max polling attempts (default: 180 = 3 minutes) */
  maxAttempts?: number
}

interface QueueResponse {
  request_id: string
}

interface PollResponse {
  status: 'completed' | 'failed' | 'pending' | 'processing'
  result: unknown
}

export class FalClient {
  private apiKey: string
  private baseUrl: string
  private pollInterval: number
  private maxAttempts: number

  constructor(config: FalConfig = {}) {
    this.apiKey = config.apiKey ?? process.env.FAL_KEY ?? ''
    this.baseUrl = config.baseUrl ?? 'https://queue.fal.run'
    this.pollInterval = config.pollInterval ?? 1000
    this.maxAttempts = config.maxAttempts ?? 180
  }

  async run<TInput, TOutput>(endpoint: string, input: TInput): Promise<TOutput> {
    // 1. Submit request to queue
    const response = await fetch(`${this.baseUrl}/${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Fal API error: ${response.status} - ${error}`)
    }

    const data = (await response.json()) as QueueResponse

    if (!data.request_id) {
      throw new Error('No request_id in response')
    }

    // 2. Poll for result
    return this.poll<TOutput>(data.request_id, endpoint)
  }

  private async poll<TOutput>(requestId: string, endpoint: string): Promise<TOutput> {
    for (let i = 0; i < this.maxAttempts; i++) {
      const response = await fetch(
        `${this.baseUrl}/${endpoint}/requests/${requestId}`,
        {
          headers: {
            Authorization: `Key ${this.apiKey}`,
          },
        }
      )

      const data = (await response.json()) as PollResponse

      if (data.status === 'completed') {
        return data.result as TOutput
      }

      if (data.status === 'failed') {
        const errorResult = data.result as { error?: string }
        throw new Error(errorResult?.error ?? 'Generation failed')
      }

      await this.sleep(this.pollInterval)
    }

    throw new Error('Timeout waiting for fal response')
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// Singleton instance for default config
let defaultClient: FalClient | null = null

export function getFalClient(config?: FalConfig): FalClient {
  if (config) {
    return new FalClient(config)
  }
  return (defaultClient ??= new FalClient())
}

