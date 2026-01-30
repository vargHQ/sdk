# Adding Models & Providers

This guide explains how to add new AI models and providers to the varg SDK.

## Overview

Providers in varg extend the [Vercel AI SDK](https://sdk.vercel.ai/) with additional model types for video, music, and other media generation. Each provider implements a consistent interface pattern.

## Architecture

```
src/ai-sdk/providers/
├── fal.ts           # Full provider (video, image, transcription)
├── elevenlabs.ts    # Speech & music provider
├── openai.ts        # Extends @ai-sdk/openai with video
├── google.ts        # Image & video provider
├── higgsfield.ts    # Image-only provider
├── replicate.ts     # Re-exports @ai-sdk/replicate
└── CONTRIBUTING.md  # This file
```

## Model Types

| Type | Interface | Use Case |
|------|-----------|----------|
| `VideoModelV3` | `../video-model.ts` | Video generation (t2v, i2v, lipsync) |
| `ImageModelV3` | `@ai-sdk/provider` | Image generation |
| `SpeechModelV3` | `@ai-sdk/provider` | Text-to-speech |
| `MusicModelV3` | `../music-model.ts` | Music generation |
| `TranscriptionModelV3` | `@ai-sdk/provider` | Speech-to-text |
| `LanguageModelV3` | `@ai-sdk/provider` | LLM text generation |
| `EmbeddingModelV3` | `@ai-sdk/provider` | Text embeddings |

## Adding a New Model to an Existing Provider

### Example: Adding a new video model to fal.ts

1. **Add to the model mapping:**

```typescript
const VIDEO_MODELS: Record<string, { t2v: string; i2v: string }> = {
  // existing models...
  "new-model-v1": {
    t2v: "fal-ai/new-model/text-to-video",
    i2v: "fal-ai/new-model/image-to-video",
  },
};
```

2. **That's it!** The existing `FalVideoModel` class handles the rest.

### Example: Adding a model with special handling

If the new model needs custom logic, add conditional handling in `doGenerate()`:

```typescript
async doGenerate(options: VideoModelV3CallOptions) {
  const isNewModel = this.modelId === "new-model-v1";
  
  if (isNewModel) {
    // Custom input handling for this model
    input.special_param = options.providerOptions?.fal?.specialParam;
  }
  
  // ... rest of generation logic
}
```

## Creating a New Provider

### Step 1: Define the Provider Interface

```typescript
import {
  type EmbeddingModelV3,
  type ImageModelV3,
  type LanguageModelV3,
  NoSuchModelError,
  type ProviderV3,
} from "@ai-sdk/provider";
import type { VideoModelV3 } from "../video-model";

export interface MyProviderSettings {
  apiKey?: string;
  baseURL?: string;
}

export interface MyProvider extends ProviderV3 {
  // Add methods for each model type you support
  videoModel(modelId: string): VideoModelV3;
  imageModel(modelId: string): ImageModelV3;
}
```

### Step 2: Implement Model Classes

Each model class must implement the corresponding interface:

```typescript
class MyVideoModel implements VideoModelV3 {
  readonly specificationVersion = "v3" as const;
  readonly provider = "myprovider";
  readonly modelId: string;
  readonly maxVideosPerCall = 1;

  private apiKey: string;

  constructor(modelId: string, options: { apiKey?: string } = {}) {
    this.modelId = modelId;
    this.apiKey = options.apiKey ?? process.env.MY_PROVIDER_API_KEY ?? "";
  }

  async doGenerate(options: VideoModelV3CallOptions) {
    const {
      prompt,
      duration,
      aspectRatio,
      files,
      providerOptions,
      abortSignal,
    } = options;
    
    const warnings: SharedV3Warning[] = [];

    // 1. Build API request
    const input: Record<string, unknown> = {
      prompt,
      duration: duration ?? 5,
      ...(providerOptions?.myprovider ?? {}),
    };

    // 2. Handle file inputs (for image-to-video, etc.)
    if (files && files.length > 0) {
      const imageFile = files.find(f => 
        f.type === "file" 
          ? f.mediaType?.startsWith("image/")
          : /\.(jpg|jpeg|png|webp)$/i.test(f.url)
      );
      if (imageFile) {
        input.image_url = await this.uploadFile(imageFile);
      }
    }

    // 3. Call the API
    const response = await fetch("https://api.myprovider.com/v1/generate", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      signal: abortSignal,
    });

    if (!response.ok) {
      throw new Error(`API error: ${await response.text()}`);
    }

    const data = await response.json();

    // 4. Download the result
    const videoResponse = await fetch(data.video_url, { signal: abortSignal });
    const videoBuffer = new Uint8Array(await videoResponse.arrayBuffer());

    // 5. Return in standard format
    return {
      videos: [videoBuffer],
      warnings,
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
        headers: undefined,
      },
    };
  }

  private async uploadFile(file: ImageModelV3File): Promise<string> {
    // Implementation depends on provider's upload mechanism
  }
}
```

### Step 3: Create the Provider Factory

```typescript
export function createMyProvider(
  settings: MyProviderSettings = {},
): MyProvider {
  const apiKey = settings.apiKey ?? process.env.MY_PROVIDER_API_KEY;
  
  if (!apiKey) {
    throw new Error("MY_PROVIDER_API_KEY not set");
  }

  return {
    specificationVersion: "v3",
    
    videoModel(modelId: string): VideoModelV3 {
      return new MyVideoModel(modelId, { apiKey });
    },
    
    imageModel(modelId: string): ImageModelV3 {
      return new MyImageModel(modelId, { apiKey });
    },
    
    // Throw NoSuchModelError for unsupported model types
    languageModel(modelId: string): LanguageModelV3 {
      throw new NoSuchModelError({ modelId, modelType: "languageModel" });
    },
    
    embeddingModel(modelId: string): EmbeddingModelV3 {
      throw new NoSuchModelError({ modelId, modelType: "embeddingModel" });
    },
  };
}
```

### Step 4: Export a Lazy Singleton

```typescript
// Lazy initialization - only creates client when first accessed
let _myprovider: MyProvider | undefined;

export const myprovider = new Proxy({} as MyProvider, {
  get(_, prop) {
    if (!_myprovider) {
      _myprovider = createMyProvider();
    }
    return _myprovider[prop as keyof MyProvider];
  },
});
```

### Step 5: Re-export from index

Add to `src/ai-sdk/index.ts`:

```typescript
export { createMyProvider, myprovider } from "./providers/myprovider";
export type { MyProvider, MyProviderSettings } from "./providers/myprovider";
```

## Handling Warnings

Use warnings to communicate unsupported features without failing:

```typescript
if (options.seed !== undefined) {
  warnings.push({
    type: "unsupported",
    feature: "seed",
    details: "Seed is not supported by this model",
  });
}

if (options.fps !== undefined) {
  warnings.push({
    type: "unsupported",
    feature: "fps",
    details: "FPS is not configurable, using provider default",
  });
}
```

## Provider Options Passthrough

Allow provider-specific options via `providerOptions`:

```typescript
// User code:
await generateVideo({
  model: myprovider.videoModel("model-v1"),
  prompt: "a cat",
  providerOptions: {
    myprovider: {
      customParam: "value",
      negativePrompt: "blurry",
    },
  },
});

// In your model:
const customOptions = providerOptions?.myprovider ?? {};
input.custom_param = customOptions.customParam;
input.negative_prompt = customOptions.negativePrompt;
```

## Async Job Polling

Many video APIs are async. Here's the standard polling pattern:

```typescript
async doGenerate(options: VideoModelV3CallOptions) {
  // 1. Create job
  const createResponse = await fetch(`${this.baseURL}/jobs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${this.apiKey}` },
    body: JSON.stringify(input),
    signal: options.abortSignal,
  });
  
  const job = await createResponse.json();
  
  // 2. Poll for completion
  let status = job.status;
  while (status === "queued" || status === "processing") {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const statusResponse = await fetch(`${this.baseURL}/jobs/${job.id}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
      signal: options.abortSignal,
    });
    
    const statusData = await statusResponse.json();
    status = statusData.status;
  }
  
  if (status === "failed") {
    throw new Error(`Generation failed: ${job.error}`);
  }
  
  // 3. Download result
  const videoResponse = await fetch(job.output_url);
  return { videos: [new Uint8Array(await videoResponse.arrayBuffer())] };
}
```

## File Upload Helpers

Common pattern for handling file inputs:

```typescript
import type { ImageModelV3File } from "@ai-sdk/provider";

async function fileToUrl(file: ImageModelV3File): Promise<string> {
  if (file.type === "url") {
    return file.url;
  }
  
  // Convert base64/Uint8Array to upload
  const bytes = typeof file.data === "string"
    ? Uint8Array.from(atob(file.data), c => c.charCodeAt(0))
    : file.data;
    
  const blob = new Blob([bytes], { type: file.mediaType ?? "image/png" });
  
  // Upload to provider's storage (or use data URL for small files)
  return await uploadToStorage(blob);
}

function getMediaType(file: ImageModelV3File): string | undefined {
  if (file.type === "file") return file.mediaType;
  
  const ext = file.url.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    mp4: "video/mp4",
  };
  return mimeTypes[ext ?? ""];
}
```

## Extending Existing Providers

To add video support to an existing AI SDK provider (like OpenAI):

```typescript
import {
  createOpenAI as createOpenAIBase,
  type OpenAIProvider as OpenAIProviderBase,
} from "@ai-sdk/openai";

// Extend the base provider interface
export interface OpenAIProvider extends OpenAIProviderBase {
  videoModel(modelId: string): VideoModelV3;
}

export function createOpenAI(settings = {}): OpenAIProvider {
  const base = createOpenAIBase(settings);
  
  // Create callable function with all base methods
  const provider = ((modelId: string) => base(modelId)) as OpenAIProvider;
  Object.assign(provider, base);
  
  // Add video support
  provider.videoModel = (modelId: string): VideoModelV3 =>
    new OpenAIVideoModel(modelId, settings);
  
  return provider;
}
```

## Re-exporting External Providers

For providers that work as-is from `@ai-sdk/*`:

```typescript
// replicate.ts - simple re-export
export {
  createReplicate,
  replicate,
  type ReplicateProvider,
  type ReplicateProviderSettings,
} from "@ai-sdk/replicate";
```

## Testing Your Provider

```typescript
import { describe, test, expect } from "bun:test";
import { createMyProvider } from "./myprovider";

describe("MyProvider", () => {
  test("creates video model", () => {
    const provider = createMyProvider({ apiKey: "test-key" });
    const model = provider.videoModel("model-v1");
    
    expect(model.provider).toBe("myprovider");
    expect(model.modelId).toBe("model-v1");
    expect(model.specificationVersion).toBe("v3");
  });
  
  test("throws on missing api key", () => {
    delete process.env.MY_PROVIDER_API_KEY;
    expect(() => createMyProvider()).toThrow("MY_PROVIDER_API_KEY not set");
  });
});
```

## Checklist for New Providers

- [ ] Implements `ProviderV3` interface
- [ ] Model classes implement correct `*ModelV3` interfaces
- [ ] `specificationVersion` is `"v3"`
- [ ] Factory function `createProvider(settings)`
- [ ] Lazy singleton export for convenience
- [ ] API key from settings OR environment variable
- [ ] `NoSuchModelError` for unsupported model types
- [ ] Warnings for unsupported features (don't fail silently)
- [ ] `providerOptions` passthrough for provider-specific params
- [ ] `abortSignal` support for cancellation
- [ ] Proper error handling with descriptive messages
- [ ] Re-exported from `src/ai-sdk/index.ts`
- [ ] Environment variable documented in README

## Questions?

Check existing providers for reference implementations:
- **Full provider**: `fal.ts` (video, image, transcription)
- **Audio provider**: `elevenlabs.ts` (speech, music)
- **Extended provider**: `openai.ts` (adds video to base)
- **Simple provider**: `higgsfield.ts` (image only)
- **Re-export**: `replicate.ts`
