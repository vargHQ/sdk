import type {
  ImageModelV3,
  ImageModelV3CallOptions,
  SharedV3Warning,
} from "@ai-sdk/provider";

const IMAGE_MODELS = ["soul", "soul/standard"] as const;
type ImageModelId = (typeof IMAGE_MODELS)[number];

export interface HiggsfieldImageModelSettings {
  style?: string;
  strength?: number;
  quality?: "medium" | "high";
  enhancePrompt?: boolean;
}

const ASPECT_RATIO_MAP: Record<string, string> = {
  "1:1": "1:1",
  "16:9": "16:9",
  "9:16": "9:16",
  "4:3": "4:3",
  "3:4": "3:4",
};

const SIZE_TO_RESOLUTION: Record<string, string> = {
  "1280x720": "720p",
  "1920x1080": "1080p",
  "720x1280": "720p",
  "1080x1920": "1080p",
};

class HiggsfieldImageModel implements ImageModelV3 {
  readonly specificationVersion = "v3" as const;
  readonly provider = "higgsfield";
  readonly modelId: string;
  readonly maxImagesPerCall = 1;

  private apiKey: string;
  private apiSecret: string;
  private baseURL: string;
  private modelSettings: HiggsfieldImageModelSettings;

  constructor(
    modelId: string,
    options: {
      apiKey?: string;
      apiSecret?: string;
      baseURL?: string;
    } & HiggsfieldImageModelSettings = {},
  ) {
    this.modelId = modelId;
    this.apiKey = options.apiKey ?? process.env.HIGGSFIELD_API_KEY ?? "";
    this.apiSecret = options.apiSecret ?? process.env.HIGGSFIELD_SECRET ?? "";
    this.baseURL = options.baseURL ?? "https://platform.higgsfield.ai";
    this.modelSettings = {
      style: options.style,
      strength: options.strength,
      quality: options.quality,
      enhancePrompt: options.enhancePrompt,
    };
  }

  async doGenerate(options: ImageModelV3CallOptions) {
    const { prompt, n, size, aspectRatio, seed, providerOptions, abortSignal } =
      options;
    const warnings: SharedV3Warning[] = [];

    // resolve endpoint
    const endpoint = this.resolveEndpoint();

    // build request body
    const body: Record<string, unknown> = {
      prompt,
    };

    // aspect ratio
    if (aspectRatio) {
      const mappedRatio = ASPECT_RATIO_MAP[aspectRatio];
      if (mappedRatio) {
        body.aspect_ratio = mappedRatio;
      } else {
        warnings.push({
          type: "unsupported",
          feature: "aspectRatio",
          details: `Aspect ratio ${aspectRatio} not supported. Use 1:1, 16:9, 9:16, 4:3, or 3:4.`,
        });
      }
    }

    // resolution from size
    if (size) {
      const resolution = SIZE_TO_RESOLUTION[size];
      if (resolution) {
        body.resolution = resolution;
      } else {
        warnings.push({
          type: "unsupported",
          feature: "size",
          details: `Size ${size} not directly supported. Using default resolution.`,
        });
      }
    }

    // n (number of images)
    if (n && n > 1) {
      warnings.push({
        type: "unsupported",
        feature: "n",
        details: "Higgsfield only generates 1 image per request.",
      });
    }

    if (seed !== undefined) {
      body.seed = seed;
    }

    if (this.modelSettings.style) {
      body.style = this.modelSettings.style;
    }
    if (this.modelSettings.strength !== undefined) {
      body.strength = this.modelSettings.strength;
    }
    if (this.modelSettings.quality) {
      body.quality = this.modelSettings.quality;
    }
    if (this.modelSettings.enhancePrompt !== undefined) {
      body.enhance_prompt = this.modelSettings.enhancePrompt;
    }

    const higgsfieldOptions = providerOptions?.higgsfield as
      | Record<string, unknown>
      | undefined;
    if (higgsfieldOptions) {
      for (const [key, value] of Object.entries(higgsfieldOptions)) {
        if (value !== undefined) {
          body[key] = value;
        }
      }
    }

    // make request
    const response = await fetch(`${this.baseURL}/${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${this.apiKey}:${this.apiSecret}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: abortSignal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Higgsfield image generation failed: ${error}`);
    }

    const result = (await response.json()) as {
      request_id?: string;
      status?: string;
      output?: { url?: string };
      url?: string;
    };

    // handle async response (poll if needed)
    let imageUrl = result.output?.url ?? result.url;

    if (!imageUrl && result.request_id) {
      // poll for completion
      const requestId = result.request_id;
      let status = result.status;

      while (status === "pending" || status === "processing") {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const statusResponse = await fetch(
          `${this.baseURL}/requests/${requestId}`,
          {
            headers: {
              Authorization: `Key ${this.apiKey}:${this.apiSecret}`,
              Accept: "application/json",
            },
            signal: abortSignal,
          },
        );

        if (!statusResponse.ok) {
          throw new Error(
            `Failed to check status: ${await statusResponse.text()}`,
          );
        }

        const statusData = (await statusResponse.json()) as {
          status: string;
          output?: { url?: string };
          url?: string;
        };
        status = statusData.status;
        imageUrl = statusData.output?.url ?? statusData.url;
      }

      if (status === "failed") {
        throw new Error("Higgsfield image generation failed");
      }
    }

    if (!imageUrl) {
      throw new Error("No image URL in Higgsfield response");
    }

    // download image
    const imageResponse = await fetch(imageUrl, { signal: abortSignal });
    const imageBuffer = await imageResponse.arrayBuffer();

    return {
      images: [new Uint8Array(imageBuffer)],
      warnings,
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
        headers: undefined,
      },
    };
  }

  private resolveEndpoint(): string {
    if (this.modelId === "soul") {
      return "higgsfield-ai/soul/standard";
    }
    if (this.modelId.startsWith("raw:")) {
      return this.modelId.slice(4);
    }
    return `higgsfield-ai/${this.modelId}`;
  }
}

export interface HiggsfieldProviderSettings {
  apiKey?: string;
  apiSecret?: string;
  baseURL?: string;
  defaultModelSettings?: HiggsfieldImageModelSettings;
}

export interface HiggsfieldProvider {
  imageModel(
    modelId: ImageModelId | (string & {}),
    settings?: HiggsfieldImageModelSettings,
  ): ImageModelV3;
}

export function createHiggsfield(
  settings: HiggsfieldProviderSettings = {},
): HiggsfieldProvider {
  return {
    imageModel(
      modelId: string,
      modelSettings?: HiggsfieldImageModelSettings,
    ): ImageModelV3 {
      return new HiggsfieldImageModel(modelId, {
        apiKey: settings.apiKey,
        apiSecret: settings.apiSecret,
        baseURL: settings.baseURL,
        ...settings.defaultModelSettings,
        ...modelSettings,
      });
    },
  };
}

export const higgsfield = createHiggsfield();
