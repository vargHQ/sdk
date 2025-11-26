# Higgsfield API Client

HTTP-based client for the Higgsfield AI platform, implementing the asynchronous queue pattern for content generation.

## Overview

The Higgsfield API uses an asynchronous request-response pattern where requests enter a queue and process in the background. This implementation provides:

- Direct HTTP requests (no external client library)
- Queue management (submit, status check, cancel)
- Automatic polling with status updates
- Webhook support for async notifications
- Model-specific clients (Soul, etc.)

## Installation

Set your Higgsfield API credentials as environment variables:

```bash
export HIGGSFIELD_API_KEY="your-api-key"
export HIGGSFIELD_SECRET="your-api-secret"
# or
export HF_API_KEY="your-api-key"
export HF_API_SECRET="your-api-secret"
```

## Usage

### Soul Image Generation

```typescript
import { generateSoul, SoulSize, SoulQuality } from "./lib/higgsfield/soul";

// Simple generation
const result = await generateSoul({
  prompt: "beautiful sunset over mountains",
  width_and_height: SoulSize.PORTRAIT_1152x2048,
  quality: SoulQuality.HD,
  batch_size: 1,
  enhance_prompt: false,
});

console.log(result.images[0].url);
```

### With Style

```typescript
import { generateSoul, listSoulStyles } from "./lib/higgsfield/soul";

// List available styles
const styles = await listSoulStyles();
console.log(styles);

// Generate with specific style
const result = await generateSoul({
  prompt: "portrait of a woman",
  style_id: "style-id-from-list",
  quality: "1080p",
});
```

### With Webhook

```typescript
const result = await generateSoul(
  {
    prompt: "landscape painting",
  },
  {
    webhook: "https://your-webhook.url/endpoint",
  },
);

// Returns immediately with request info
console.log(result.request_id);
// Your webhook will receive the result when ready
```

### Manual Queue Management

```typescript
import { SoulClient } from "./lib/higgsfield/soul";

const client = new SoulClient();

// Submit request
const request = await client.submitRequest("soul", {
  prompt: "beautiful landscape",
  quality: "1080p",
});

console.log(request.request_id);

// Check status manually
const status = await client.getStatus(request.request_id);
console.log(status.status); // "queued", "in_progress", "completed", etc.

// Cancel if still queued
if (status.status === "queued") {
  await client.cancelRequest(request.request_id);
}

// Or wait for completion
const result = await client.waitForCompletion(request.request_id, {
  pollingInterval: 2000, // 2 seconds
  maxWaitTime: 300000, // 5 minutes
  onUpdate: (status) => {
    console.log(`Status: ${status.status}`);
  },
});
```

### Using the Base Client

```typescript
import HiggsfieldClient from "./lib/higgsfield/index";

const client = new HiggsfieldClient({
  apiKey: "your-api-key",
  apiSecret: "your-api-secret",
});

// Works with any Higgsfield model
const result = await client.generate("model-id", {
  // model-specific params
});
```

## CLI Usage

### Soul Commands

```bash
# Generate image
bun run lib/higgsfield/soul.ts generate "beautiful sunset"

# Generate with style
bun run lib/higgsfield/soul.ts generate "portrait" "style-id-123"

# List available styles
bun run lib/higgsfield/soul.ts list_styles

# Check request status
bun run lib/higgsfield/soul.ts status "request-id"

# Cancel pending request
bun run lib/higgsfield/soul.ts cancel "request-id"
```

### Legacy Commands (backward compatible)

```bash
bun run lib/higgsfield.ts generate_soul "beautiful landscape"
bun run lib/higgsfield.ts list_styles
```

## API Reference

### Request Statuses

| Status | Description |
|--------|-------------|
| `queued` | Request is waiting in queue |
| `in_progress` | Generation is actively processing |
| `nsfw` | Content failed moderation (credits refunded) |
| `failed` | Generation failed (credits refunded) |
| `completed` | Generation finished successfully |
| `canceled` | Request was canceled |

### Soul Parameters

```typescript
interface SoulGenerationParams {
  prompt: string; // Required
  width_and_height?: string; // e.g., "1152x2048"
  quality?: "720p" | "1080p";
  style_id?: string; // From listSoulStyles()
  batch_size?: 1 | 4;
  enhance_prompt?: boolean;
  seed?: number;
  style_strength?: number;
  image_reference?: string; // URL
  custom_reference_id?: string;
  custom_reference_strength?: number;
}
```

### Soul Size Options

```typescript
import { SoulSize } from "./lib/higgsfield/soul";

SoulSize.PORTRAIT_1152x2048
SoulSize.PORTRAIT_2048x1152
SoulSize.SQUARE_2048x2048
SoulSize.LANDSCAPE_1536x2048
SoulSize.LANDSCAPE_2016x1344
```

### Quality Options

```typescript
import { SoulQuality } from "./lib/higgsfield/soul";

SoulQuality.SD // "720p"
SoulQuality.HD // "1080p"
```

## Webhook Integration

When you provide a webhook URL, the API will send a POST request to your endpoint when generation completes:

```typescript
// Your webhook endpoint receives:
{
  "status": "completed",
  "request_id": "uuid",
  "status_url": "https://...",
  "cancel_url": "https://...",
  "images": [{ "url": "https://..." }]
}
```

Webhook retries:
- Retries for up to 2 hours
- Continues until your endpoint returns 2xx status
- Implement idempotency using `request_id`

## Best Practices

1. **Store Request IDs**: Save `request_id` to retrieve results later
2. **Handle All Statuses**: Check for `completed`, `failed`, `nsfw`, and `canceled`
3. **Use Webhooks for Long Tasks**: Avoid keeping connections open
4. **Implement Idempotency**: Handle duplicate webhook deliveries gracefully
5. **Set Reasonable Timeouts**: Default is 5 minutes, adjust as needed
6. **Cancel Unused Requests**: Free up queue slots when possible

## Migration from Client Library

If you're migrating from `@higgsfield/client`:

### Before
```typescript
import { HiggsfieldClient } from "@higgsfield/client";

const client = new HiggsfieldClient({ apiKey, apiSecret });
const jobSet = await client.generate("/v1/text2image/soul", params);
```

### After
```typescript
import { generateSoul } from "./lib/higgsfield/soul";

const result = await generateSoul(params);
```

The new API returns the same data structure but uses native HTTP requests instead of a client library.

## Architecture

```
lib/higgsfield/
├── index.ts        # Base HiggsfieldClient class
├── soul.ts         # Soul-specific API
└── README.md       # This file

lib/higgsfield.ts   # Backward-compatible wrapper
```

Each model can have its own file with specialized methods while sharing the base queue management from `index.ts`.


