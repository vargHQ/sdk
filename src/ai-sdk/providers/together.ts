import {
  type ImageModelV3,
  type ImageModelV3CallOptions,
  NoSuchModelError,
  type SharedV3Warning,
} from "@ai-sdk/provider";

const IMAGE_MODELS: Record<string, string> = {
  "flux-schnell": "black-forest-labs/FLUX.1-schnell",
  "flux-dev": "black-forest-labs/FLUX.1-dev",
  "flux-pro": "black-forest-labs/FLUX.1-pro",
  "flux-1.1-pro": "black-forest-labs/FLUX.1.1-pro",
  "flux-kontext-pro": "black-forest-labs/FLUX.1-kontext-pro",
  "flux-kontext-max": "black-forest-labs/FLUX.1-kontext-max",
};

// Aspect ratio to width/height mapping
const ASPECT_RATIO_DIMENSIONS: Record<
  string,
  { width: number; height: number }
> = {
  "1:1": { width: 1024, height: 1024 },
  "4:3": { width: 1024, height: 768 },
  "3:4": { width: 768, height: 1024 },
  "16:9": { width: 1344, height: 768 },
  "9:16": { width: 768, height: 1344 },
  "3:2": { width: 1024, height: 683 },
  "2:3": { width: 683, height: 1024 },
};

interface TogetherProviderOptions {
  apiKey?: string;
  baseUrl?: string;
}

class TogetherImageModel implements ImageModelV3 {
  readonly specificationVersion = "v3" as const;
  readonly provider = "together";
  readonly modelId: string;
  readonly maxImagesPerCall = 4;

  private apiKey: string;
  private baseUrl: string;

  constructor(modelId: string, options: TogetherProviderOptions = {}) {
    this.modelId = modelId;
    this.apiKey = options.apiKey ?? process.env.TOGETHER_API_KEY ?? "";
    this.baseUrl = options.baseUrl ?? "https://api.together.xyz/v1";

    if (!this.apiKey) {
      throw new Error(
        "Together API key is required. Set TOGETHER_API_KEY environment variable or pass apiKey option.",
      );
    }
  }

  async doGenerate(options: ImageModelV3CallOptions) {
    const { prompt, n, size, aspectRatio, seed, providerOptions, abortSignal } =
      options;
    const warnings: SharedV3Warning[] = [];

    // Resolve model endpoint
    const model = IMAGE_MODELS[this.modelId] ?? this.modelId;

    // Build request body
    const body: Record<string, unknown> = {
      model,
      prompt,
      n: n ?? 1,
      steps: 4, // flux-schnell optimal steps
      ...(providerOptions?.together ?? {}),
    };

    // Handle size
    if (size) {
      const [width, height] = size.split("x").map(Number);
      body.width = width;
      body.height = height;
    } else if (aspectRatio) {
      const dims = ASPECT_RATIO_DIMENSIONS[aspectRatio];
      if (dims) {
        body.width = dims.width;
        body.height = dims.height;
      } else {
        warnings.push({
          type: "unsupported",
          feature: "aspectRatio",
          details: `Aspect ratio "${aspectRatio}" not supported, using default 1024x1024`,
        });
        body.width = 1024;
        body.height = 1024;
      }
    }

    if (seed !== undefined) {
      body.seed = seed;
    }

    // Timing diagnostics
    const t0 = Date.now();

    const response = await fetch(`${this.baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: abortSignal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Together API error: ${response.status} ${error}`);
    }

    const data = (await response.json()) as {
      data: Array<{ url?: string; b64_json?: string }>;
    };

    const apiTime = Date.now() - t0;
    console.log(
      `[together-timing] ${this.modelId}: API call took ${apiTime}ms`,
    );

    const images = data.data ?? [];
    if (images.length === 0) {
      throw new Error("No images in Together response");
    }

    // Download images from URLs
    const t1 = Date.now();
    const imageBuffers = await Promise.all(
      images.map(async (img) => {
        if (img.b64_json) {
          // Base64 response
          return new Uint8Array(Buffer.from(img.b64_json, "base64"));
        }
        if (img.url) {
          // URL response - download
          const imgResponse = await fetch(img.url, { signal: abortSignal });
          return new Uint8Array(await imgResponse.arrayBuffer());
        }
        throw new Error("Image has neither url nor b64_json");
      }),
    );
    const downloadTime = Date.now() - t1;
    console.log(
      `[together-timing] ${this.modelId}: image download took ${downloadTime}ms`,
    );
    console.log(
      `[together-timing] ${this.modelId}: TOTAL ${Date.now() - t0}ms`,
    );

    return {
      images: imageBuffers,
      warnings,
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
        headers: undefined,
      },
    };
  }
}

interface TogetherProvider {
  imageModel: (modelId: string) => ImageModelV3;
}

function createTogetherProvider(
  options: TogetherProviderOptions = {},
): TogetherProvider {
  const imageModel = (modelId: string): ImageModelV3 => {
    if (!IMAGE_MODELS[modelId] && !modelId.includes("/")) {
      throw new NoSuchModelError({
        modelId,
        modelType: "imageModel",
        message: `Unknown image model: ${modelId}. Available: ${Object.keys(IMAGE_MODELS).join(", ")}`,
      });
    }
    return new TogetherImageModel(modelId, options);
  };

  return {
    imageModel,
  };
}

export const together = createTogetherProvider();
export { createTogetherProvider };
