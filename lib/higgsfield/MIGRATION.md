# Migration Guide: @higgsfield/client to HTTP API

This guide helps you migrate from the old `@higgsfield/client` library to the new HTTP-based implementation.

## Summary of Changes

### What Changed

1. **No external client library** - Now uses native `fetch()` for HTTP requests
2. **Response structure** - New structure matching the official API
3. **Parameter naming** - Uses snake_case (API convention) instead of camelCase
4. **Queue management** - Direct access to status checking and cancellation
5. **Webhook support** - Built-in webhook functionality

### What Stayed the Same

- Authentication via environment variables
- Core functionality (generate, list styles)
- CLI commands (backward compatible)
- Async/await patterns

## API Changes

### Before (Old Client)

```typescript
import { HiggsfieldClient, SoulSize, SoulQuality } from "@higgsfield/client";

const client = new HiggsfieldClient({
  apiKey: process.env.HF_API_KEY,
  apiSecret: process.env.HF_API_SECRET,
});

const jobSet = await client.generate("/v1/text2image/soul", {
  prompt: "beautiful sunset",
  width_and_height: SoulSize.PORTRAIT_1152x2048,
  quality: SoulQuality.HD,
  style_id: "some-style-id",
  batch_size: 1,
  enhance_prompt: false,
});

// Access results
const imageUrl = jobSet.jobs[0].results.raw.url;
console.log(jobSet.id);
console.log(jobSet.isCompleted);
```

### After (New HTTP API)

```typescript
import { generateSoul, SoulSize, SoulQuality } from "./lib/higgsfield/soul";

const result = await generateSoul({
  prompt: "beautiful sunset",
  width_and_height: SoulSize.PORTRAIT_1152x2048,
  quality: SoulQuality.HD,
  style_id: "some-style-id",
  batch_size: 1,
  enhance_prompt: false,
});

// Access results
const imageUrl = result.images[0].url;
console.log(result.request_id);
console.log(result.status === "completed");
```

## Response Structure Changes

### Old Structure

```typescript
{
  id: string;
  isCompleted: boolean;
  isFailed: boolean;
  jobs: Array<{
    results: {
      raw: { url: string };
    };
  }>;
}
```

### New Structure

```typescript
{
  status: "queued" | "in_progress" | "completed" | "failed" | "nsfw" | "canceled";
  request_id: string;
  status_url: string;
  cancel_url: string;
  images?: Array<{ url: string }>;
  video?: { url: string };
  error?: string;
}
```

## Common Migration Patterns

### Pattern 1: Simple Generation

**Before:**
```typescript
const jobSet = await client.generate("/v1/text2image/soul", {
  prompt: "test",
  width_and_height: SoulSize.PORTRAIT_1152x2048,
});

if (jobSet.isCompleted && jobSet.jobs.length > 0) {
  const url = jobSet.jobs[0].results.raw.url;
}
```

**After:**
```typescript
const result = await generateSoul({
  prompt: "test",
  width_and_height: SoulSize.PORTRAIT_1152x2048,
});

if (result.status === "completed" && result.images) {
  const url = result.images[0].url;
}
```

### Pattern 2: Error Handling

**Before:**
```typescript
if (jobSet.isFailed) {
  console.error("Generation failed");
}
```

**After:**
```typescript
if (result.status === "failed") {
  console.error(`Generation failed: ${result.error}`);
} else if (result.status === "nsfw") {
  console.error("Content flagged as NSFW");
}
```

### Pattern 3: List Styles

**Before:**
```typescript
const styles = await client.getSoulStyles();
```

**After:**
```typescript
import { listSoulStyles } from "./lib/higgsfield/soul";

const styles = await listSoulStyles();
```

## New Features

### 1. Manual Queue Management

```typescript
import { SoulClient } from "./lib/higgsfield/soul";

const client = new SoulClient();

// Submit request
const request = await client.submitRequest("soul", {
  prompt: "test",
});

// Check status later
const status = await client.getStatus(request.request_id);

// Cancel if needed
if (status.status === "queued") {
  await client.cancelRequest(request.request_id);
}
```

### 2. Webhook Support

```typescript
const result = await generateSoul(
  {
    prompt: "test",
  },
  {
    webhook: "https://your-webhook.url/endpoint",
  },
);

// Returns immediately with request info
// Your webhook receives the result when ready
```

### 3. Status Updates During Generation

```typescript
const result = await generateSoul(
  {
    prompt: "test",
  },
  {
    onUpdate: (status) => {
      console.log(`Current status: ${status.status}`);
    },
  },
);
```

## Breaking Changes Checklist

- [ ] Update imports from `@higgsfield/client` to `./lib/higgsfield/soul`
- [ ] Change `jobSet.jobs[0].results.raw.url` to `result.images[0].url`
- [ ] Change `jobSet.id` to `result.request_id`
- [ ] Change `jobSet.isCompleted` to `result.status === "completed"`
- [ ] Change `jobSet.isFailed` to `result.status === "failed"`
- [ ] Remove `@higgsfield/client` from package.json
- [ ] Run `bun install` to clean up dependencies
- [ ] Update parameter names to snake_case if using object literals

## Environment Variables

No changes needed - same variables work:

```bash
export HIGGSFIELD_API_KEY="your-key"
export HIGGSFIELD_SECRET="your-secret"

# or

export HF_API_KEY="your-key"
export HF_API_SECRET="your-secret"
```

## CLI Commands

### Backward Compatible

```bash
# Old commands still work
bun run lib/higgsfield.ts generate_soul "prompt"
bun run lib/higgsfield.ts list_styles
```

### New Commands (More Features)

```bash
# Generate
bun run lib/higgsfield/soul.ts generate "prompt" "style-id"

# List styles
bun run lib/higgsfield/soul.ts list_styles

# Check status
bun run lib/higgsfield/soul.ts status "request-id"

# Cancel request
bun run lib/higgsfield/soul.ts cancel "request-id"
```

## Testing Your Migration

```bash
# Run examples to verify everything works
bun run lib/higgsfield/example.ts simple
bun run lib/higgsfield/example.ts style
bun run lib/higgsfield/example.ts all
```

## Rollback Plan

If you need to temporarily rollback:

1. Reinstall the old client:
   ```bash
   bun add @higgsfield/client@^0.1.2
   ```

2. Restore old imports in your code

3. The old implementation is still available in git history if needed

## Getting Help

- See `lib/higgsfield/README.md` for full documentation
- See `lib/higgsfield/example.ts` for usage examples
- Check the official API docs at https://platform.higgsfield.ai

## Benefits of Migration

✅ No external client library dependency  
✅ Full control over HTTP requests  
✅ Webhook support for production workflows  
✅ Better error messages  
✅ Cancel pending requests  
✅ Direct API compatibility  
✅ Smaller bundle size  
✅ More TypeScript types  

## Questions?

Open an issue or check the examples in `lib/higgsfield/example.ts` for common use cases.


