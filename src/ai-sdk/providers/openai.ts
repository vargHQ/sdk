import {
  createOpenAI as createOpenAIBase,
  type OpenAIProvider as OpenAIProviderBase,
  type OpenAIProviderSettings,
} from "@ai-sdk/openai";
import type { SharedV3Warning } from "@ai-sdk/provider";
import type { VideoModelV3, VideoModelV3CallOptions } from "../video-model";

// re-export base types
export type { OpenAIProviderSettings };

const VIDEO_MODELS = ["sora-2", "sora-2-pro"] as const;
type VideoModelId = (typeof VIDEO_MODELS)[number];

const SIZE_MAP: Record<string, string> = {
  "9:16": "720x1280",
  "16:9": "1280x720",
  "1:1": "1024x1024",
};

class OpenAIVideoModel implements VideoModelV3 {
  readonly specificationVersion = "v3" as const;
  readonly provider = "openai";
  readonly modelId: string;
  readonly maxVideosPerCall = 1;

  private apiKey: string;
  private baseURL: string;

  constructor(
    modelId: string,
    options: { apiKey?: string; baseURL?: string } = {},
  ) {
    this.modelId = modelId;
    this.apiKey = options.apiKey ?? process.env.OPENAI_API_KEY ?? "";
    this.baseURL = options.baseURL ?? "https://api.openai.com/v1";
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

    // build form data
    const formData = new FormData();
    formData.append("model", this.modelId);
    formData.append("prompt", prompt);

    // duration: sora accepts 4, 8, 12 seconds
    const seconds = duration ?? 4;
    const validSeconds = [4, 8, 12].includes(seconds) ? seconds : 4;
    if (duration && ![4, 8, 12].includes(duration)) {
      warnings.push({
        type: "unsupported",
        feature: "duration",
        details: `Duration ${duration}s not supported. Using ${validSeconds}s. Sora supports: 4, 8, 12 seconds.`,
      });
    }
    formData.append("seconds", String(validSeconds));

    // size from aspect ratio
    if (aspectRatio) {
      const size = SIZE_MAP[aspectRatio];
      if (size) {
        formData.append("size", size);
      } else {
        warnings.push({
          type: "unsupported",
          feature: "aspectRatio",
          details: `Aspect ratio ${aspectRatio} not directly supported. Use 9:16, 16:9, or 1:1.`,
        });
      }
    }

    // image input for i2v
    if (files && files.length > 0) {
      const imageFile = files.find((f) => {
        if (f.type === "file") return f.mediaType?.startsWith("image/");
        return /\.(jpg|jpeg|png|webp)$/i.test(f.url);
      });

      if (imageFile) {
        let blob: Blob;
        if (imageFile.type === "file") {
          const data =
            typeof imageFile.data === "string"
              ? Uint8Array.from(atob(imageFile.data), (c) => c.charCodeAt(0))
              : imageFile.data;
          blob = new Blob([data], { type: imageFile.mediaType });
        } else {
          const response = await fetch(imageFile.url, { signal: abortSignal });
          blob = await response.blob();
        }
        formData.append("input_reference", blob, "input.png");
      }
    }

    // provider options passthrough
    const openaiOptions = providerOptions?.openai as
      | Record<string, unknown>
      | undefined;
    if (openaiOptions) {
      for (const [key, value] of Object.entries(openaiOptions)) {
        if (
          value !== undefined &&
          !["model", "prompt", "seconds", "size", "input_reference"].includes(
            key,
          )
        ) {
          formData.append(key, String(value));
        }
      }
    }

    // unsupported options
    if (options.seed !== undefined) {
      warnings.push({
        type: "unsupported",
        feature: "seed",
        details: "Seed is not supported by OpenAI Sora",
      });
    }
    if (options.fps !== undefined) {
      warnings.push({
        type: "unsupported",
        feature: "fps",
        details: "FPS is not configurable for Sora",
      });
    }
    if (options.resolution !== undefined) {
      warnings.push({
        type: "unsupported",
        feature: "resolution",
        details: "Use aspectRatio instead. Sora supports 9:16, 16:9, 1:1.",
      });
    }

    // create video job
    const createResponse = await fetch(`${this.baseURL}/videos`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
      signal: abortSignal,
    });

    if (!createResponse.ok) {
      const error = await createResponse.text();
      throw new Error(`OpenAI video creation failed: ${error}`);
    }

    const job = (await createResponse.json()) as {
      id: string;
      status: string;
      progress?: number;
    };

    // poll for completion
    let status = job.status;
    const videoId = job.id;

    while (status === "queued" || status === "in_progress") {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const statusResponse = await fetch(`${this.baseURL}/videos/${videoId}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        signal: abortSignal,
      });

      if (!statusResponse.ok) {
        throw new Error(
          `Failed to check video status: ${await statusResponse.text()}`,
        );
      }

      const statusData = (await statusResponse.json()) as {
        status: string;
        progress?: number;
      };
      status = statusData.status;
    }

    if (status === "failed") {
      throw new Error("OpenAI video generation failed");
    }

    // download completed video
    const contentResponse = await fetch(
      `${this.baseURL}/videos/${videoId}/content`,
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        signal: abortSignal,
      },
    );

    if (!contentResponse.ok) {
      throw new Error(
        `Failed to download video: ${await contentResponse.text()}`,
      );
    }

    const videoBuffer = await contentResponse.arrayBuffer();

    return {
      videos: [new Uint8Array(videoBuffer)],
      warnings,
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
        headers: undefined,
      },
    };
  }
}

export interface OpenAIProvider extends OpenAIProviderBase {
  videoModel(modelId: VideoModelId): VideoModelV3;
}

export function createOpenAI(
  settings: OpenAIProviderSettings = {},
): OpenAIProvider {
  const base = createOpenAIBase(settings);

  // create a callable function that also has all the methods
  const provider = ((modelId: string) => base(modelId)) as OpenAIProvider;

  // copy all properties from base
  Object.assign(provider, base);

  // add videoModel method
  provider.videoModel = (modelId: VideoModelId): VideoModelV3 =>
    new OpenAIVideoModel(modelId, {
      apiKey: settings.apiKey,
      baseURL: settings.baseURL,
    });

  return provider;
}

export const openai = createOpenAI();
