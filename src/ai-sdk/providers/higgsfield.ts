import type {
  ImageModelV3,
  ImageModelV3CallOptions,
  SharedV3Warning,
} from "@ai-sdk/provider";

const IMAGE_MODELS = ["soul"] as const;
type ImageModelId = (typeof IMAGE_MODELS)[number];

export interface HiggsfieldImageModelSettings {
  styleId?: string;
  quality?: "720p" | "1080p";
  enhancePrompt?: boolean;
}

// Maps aspect ratio to width_and_height for Soul API
const ASPECT_RATIO_TO_SIZE: Record<string, string> = {
  "1:1": "1536x1536",
  "16:9": "2048x1152",
  "9:16": "1152x2048",
  "4:3": "2048x1536",
  "3:4": "1536x2048",
};

class HiggsfieldImageModel implements ImageModelV3 {
  readonly specificationVersion = "v3" as const;
  readonly provider = "higgsfield";
  readonly modelId: string;
  readonly maxImagesPerCall = 4;

  private apiKey: string;
  private apiSecret: string;
  private baseURL: string;
  private modelSettings: HiggsfieldImageModelSettings;

  get settings(): HiggsfieldImageModelSettings {
    return this.modelSettings;
  }

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
      styleId: options.styleId,
      quality: options.quality,
      enhancePrompt: options.enhancePrompt,
    };
  }

  async doGenerate(options: ImageModelV3CallOptions) {
    const { prompt, n, aspectRatio, providerOptions, abortSignal } = options;
    const warnings: SharedV3Warning[] = [];

    // Map aspect ratio to width_and_height
    const widthAndHeight = aspectRatio
      ? (ASPECT_RATIO_TO_SIZE[aspectRatio] ?? "1536x1536")
      : "1536x1536";

    if (aspectRatio && !ASPECT_RATIO_TO_SIZE[aspectRatio]) {
      warnings.push({
        type: "unsupported",
        feature: "aspectRatio",
        details: `Aspect ratio ${aspectRatio} not supported. Using 1:1. Supported: 1:1, 16:9, 9:16, 4:3, 3:4.`,
      });
    }

    // Build params object - matching working implementation
    const params: Record<string, unknown> = {
      prompt,
      width_and_height: widthAndHeight,
      enhance_prompt: this.modelSettings.enhancePrompt ?? false,
      quality: this.modelSettings.quality ?? "1080p",
      batch_size: n && n <= 4 ? n : 1,
    };

    // Add optional parameters only if provided
    if (this.modelSettings.styleId) {
      params.style_id = this.modelSettings.styleId;
    }

    // Merge provider options
    const higgsfieldOptions = providerOptions?.higgsfield as
      | Record<string, unknown>
      | undefined;
    if (higgsfieldOptions) {
      for (const [key, value] of Object.entries(higgsfieldOptions)) {
        if (value !== undefined && value !== null) {
          params[key] = value;
        }
      }
    }

    // Request body wrapped in params
    const requestBody = { params };

    // Make request to /v1/text2image/soul
    const response = await fetch(`${this.baseURL}/v1/text2image/soul`, {
      method: "POST",
      headers: {
        "hf-api-key": this.apiKey,
        "hf-secret": this.apiSecret,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: abortSignal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Higgsfield Soul API error (${response.status}): ${errorText}`,
      );
    }

    const data = (await response.json()) as { id?: string };
    const jobId = data?.id;

    if (!jobId) {
      throw new Error("No job ID returned from Higgsfield Soul API");
    }

    // Poll for results
    const imageUrl = await this.pollForResult(jobId, abortSignal);

    // Download image
    const imageResponse = await fetch(imageUrl, { signal: abortSignal });
    const imageBuffer = new Uint8Array(await imageResponse.arrayBuffer());

    return {
      images: [imageBuffer],
      warnings,
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
        headers: undefined,
      },
    };
  }

  private async pollForResult(
    jobId: string,
    abortSignal?: AbortSignal,
  ): Promise<string> {
    const maxAttempts = 60;
    const pollInterval = 5000; // 5 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await fetch(`${this.baseURL}/v1/job-sets/${jobId}`, {
        method: "GET",
        headers: {
          "hf-api-key": this.apiKey,
          "hf-secret": this.apiSecret,
          Accept: "application/json",
        },
        signal: abortSignal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Higgsfield polling error (${response.status}): ${errorText}`,
        );
      }

      const jobSet = (await response.json()) as {
        jobs?: Array<{
          status?: string;
          results?: {
            min?: { url?: string };
            raw?: { url?: string };
          };
        }>;
      };

      // Check if jobs array exists and has at least one job
      if (
        !jobSet?.jobs ||
        !Array.isArray(jobSet.jobs) ||
        jobSet.jobs.length === 0
      ) {
        throw new Error("No jobs found in Higgsfield JobSet response");
      }

      const job = jobSet.jobs[0];
      const jobStatus = job?.status;

      if (jobStatus === "completed") {
        const results = job?.results;

        if (results) {
          // Try to get URL from results object
          const imageUrl = results.min?.url ?? results.raw?.url;

          if (imageUrl) {
            return imageUrl;
          }
        }

        throw new Error("No result URL found in completed Higgsfield job");
      }

      if (jobStatus === "failed") {
        throw new Error("Higgsfield job failed");
      }

      if (jobStatus === "nsfw") {
        throw new Error("Higgsfield job rejected due to NSFW content");
      }

      // Still processing, wait before next poll
      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }
    }

    throw new Error("Higgsfield generation timed out after 5 minutes");
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
