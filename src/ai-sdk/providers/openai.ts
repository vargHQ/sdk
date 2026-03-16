import {
  createOpenAI as createOpenAIBase,
  type OpenAIProvider as OpenAIProviderBase,
  type OpenAIProviderSettings,
} from "@ai-sdk/openai";
import type {
  ImageModelV3,
  ImageModelV3CallOptions,
  SharedV3Warning,
  TranscriptionModelV3,
  TranscriptionModelV3CallOptions,
} from "@ai-sdk/provider";
import type { VideoModelV3, VideoModelV3CallOptions } from "../video-model";

// re-export base types
export type { OpenAIProviderSettings };

// video models
const VIDEO_MODELS = ["sora-2", "sora-2-pro"] as const;
type VideoModelId = (typeof VIDEO_MODELS)[number];

// image models
const IMAGE_MODELS = [
  "gpt-image-1",
  "gpt-image-1-mini",
  "gpt-image-1.5",
  "dall-e-2",
  "dall-e-3",
] as const;
type ImageModelId = (typeof IMAGE_MODELS)[number];

// transcription models
const TRANSCRIPTION_MODELS = [
  "whisper-1",
  "gpt-4o-transcribe",
  "gpt-4o-mini-transcribe",
] as const;
type TranscriptionModelId = (typeof TRANSCRIPTION_MODELS)[number];

// sora video size mappings - full support per official api
const VIDEO_SIZE_MAP: Record<string, string> = {
  "9:16": "720x1280",
  "16:9": "1280x720",
  "1:1": "1024x1024",
  // additional supported sizes
  "9:21": "1024x1792",
  "21:9": "1792x1024",
};

// image size mappings per model
const DALLE3_SIZE_MAP: Record<string, string> = {
  "1:1": "1024x1024",
  "16:9": "1792x1024",
  "9:16": "1024x1792",
};

const DALLE2_SIZES = ["256x256", "512x512", "1024x1024"];

const GPT_IMAGE_SIZE_MAP: Record<string, string> = {
  "1:1": "1024x1024",
  "3:2": "1536x1024",
  "2:3": "1024x1536",
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
      const size = VIDEO_SIZE_MAP[aspectRatio];
      if (size) {
        formData.append("size", size);
      } else {
        warnings.push({
          type: "unsupported",
          feature: "aspectRatio",
          details: `Aspect ratio ${aspectRatio} not directly supported. Supported: 9:16, 16:9, 1:1, 9:21, 21:9.`,
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
        details:
          "Use aspectRatio instead. Sora supports 9:16, 16:9, 1:1, 9:21, 21:9.",
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

class OpenAIImageModel implements ImageModelV3 {
  readonly specificationVersion = "v3" as const;
  readonly provider = "openai";
  readonly modelId: string;
  readonly maxImagesPerCall: number;

  private apiKey: string;
  private baseURL: string;

  constructor(
    modelId: string,
    options: { apiKey?: string; baseURL?: string } = {},
  ) {
    this.modelId = modelId;
    this.apiKey = options.apiKey ?? process.env.OPENAI_API_KEY ?? "";
    this.baseURL = options.baseURL ?? "https://api.openai.com/v1";
    // dall-e-3 only supports n=1, others support more
    this.maxImagesPerCall = modelId === "dall-e-3" ? 1 : 10;
  }

  async doGenerate(options: ImageModelV3CallOptions) {
    const {
      prompt,
      n = 1,
      size,
      aspectRatio,
      seed,
      providerOptions,
      abortSignal,
    } = options;
    const warnings: SharedV3Warning[] = [];

    const isGptImage = this.modelId.startsWith("gpt-image");
    const isDalle3 = this.modelId === "dall-e-3";
    const isDalle2 = this.modelId === "dall-e-2";

    // build request body
    const body: Record<string, unknown> = {
      model: this.modelId,
      prompt: prompt ?? "",
      n: isDalle3 ? 1 : n,
    };

    // handle size/aspectRatio
    let resolvedSize: string | undefined;
    if (size) {
      resolvedSize = size;
    } else if (aspectRatio) {
      if (isGptImage) {
        resolvedSize = GPT_IMAGE_SIZE_MAP[aspectRatio];
      } else if (isDalle3) {
        resolvedSize = DALLE3_SIZE_MAP[aspectRatio];
      } else if (isDalle2) {
        // dalle-2 only supports square
        resolvedSize = "1024x1024";
        if (aspectRatio !== "1:1") {
          warnings.push({
            type: "unsupported",
            feature: "aspectRatio",
            details: `DALL-E 2 only supports 1:1. Using 1024x1024.`,
          });
        }
      }
    }

    if (resolvedSize) {
      body.size = resolvedSize;
    }

    // gpt-image specific options
    if (isGptImage) {
      // gpt-image always returns b64_json
      body.response_format = "b64_json";

      const gptOptions = providerOptions?.openai as
        | Record<string, unknown>
        | undefined;
      if (gptOptions?.quality) {
        body.quality = gptOptions.quality; // low, medium, high, auto
      }
      if (gptOptions?.output_format) {
        body.output_format = gptOptions.output_format; // png, jpeg, webp
      }
      if (gptOptions?.background) {
        body.background = gptOptions.background; // transparent, opaque, auto
      }
    } else {
      // dall-e models
      body.response_format = "b64_json";

      if (isDalle3) {
        const dalleOptions = providerOptions?.openai as
          | Record<string, unknown>
          | undefined;
        if (dalleOptions?.quality) {
          body.quality = dalleOptions.quality; // hd, standard
        }
        if (dalleOptions?.style) {
          body.style = dalleOptions.style; // vivid, natural
        }
      }
    }

    // seed not supported
    if (seed !== undefined) {
      warnings.push({
        type: "unsupported",
        feature: "seed",
        details: "Seed is not supported by OpenAI image models",
      });
    }

    // dall-e-3 only supports n=1
    if (isDalle3 && n > 1) {
      warnings.push({
        type: "unsupported",
        feature: "n",
        details: `DALL-E 3 only supports n=1. Requested ${n}, generating 1 image.`,
      });
    }

    const response = await fetch(`${this.baseURL}/images/generations`, {
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
      throw new Error(`OpenAI image generation failed: ${error}`);
    }

    const result = (await response.json()) as {
      data: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
    };

    const images = result.data.map((item) => {
      if (item.b64_json) {
        return Uint8Array.from(atob(item.b64_json), (c) => c.charCodeAt(0));
      }
      throw new Error("Expected b64_json response from OpenAI");
    });

    return {
      images,
      warnings,
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
        headers: undefined,
      },
    };
  }
}

class OpenAITranscriptionModel implements TranscriptionModelV3 {
  readonly specificationVersion = "v3" as const;
  readonly provider = "openai";
  readonly modelId: string;

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

  async doGenerate(options: TranscriptionModelV3CallOptions) {
    const { audio, mediaType, providerOptions, abortSignal } = options;
    const warnings: SharedV3Warning[] = [];

    // convert audio to blob
    const audioBytes =
      typeof audio === "string"
        ? Uint8Array.from(atob(audio), (c) => c.charCodeAt(0))
        : audio;

    // determine file extension from media type
    const extMap: Record<string, string> = {
      "audio/flac": "flac",
      "audio/mpeg": "mp3",
      "audio/mp3": "mp3",
      "audio/mp4": "mp4",
      "audio/m4a": "m4a",
      "audio/ogg": "ogg",
      "audio/wav": "wav",
      "audio/webm": "webm",
    };
    const ext = extMap[mediaType] ?? "mp3";

    const blob = new Blob([audioBytes], { type: mediaType });

    // build form data
    const formData = new FormData();
    formData.append("file", blob, `audio.${ext}`);
    formData.append("model", this.modelId);

    // default to verbose_json for segment timestamps
    formData.append("response_format", "verbose_json");

    // provider options
    const openaiOptions = providerOptions?.openai as
      | Record<string, unknown>
      | undefined;
    if (openaiOptions?.language) {
      formData.append("language", String(openaiOptions.language));
    }
    if (openaiOptions?.prompt) {
      formData.append("prompt", String(openaiOptions.prompt));
    }
    if (openaiOptions?.temperature !== undefined) {
      formData.append("temperature", String(openaiOptions.temperature));
    }
    // whisper-1 supports timestamp granularities
    if (
      this.modelId === "whisper-1" &&
      openaiOptions?.timestamp_granularities
    ) {
      const granularities = openaiOptions.timestamp_granularities as string[];
      for (const g of granularities) {
        formData.append("timestamp_granularities[]", g);
      }
    }

    const response = await fetch(`${this.baseURL}/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
      signal: abortSignal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI transcription failed: ${error}`);
    }

    const result = (await response.json()) as {
      text: string;
      language?: string;
      duration?: number;
      segments?: Array<{
        start: number;
        end: number;
        text: string;
      }>;
      words?: Array<{
        start: number;
        end: number;
        word: string;
      }>;
    };

    return {
      text: result.text,
      segments: (result.segments ?? []).map((seg) => ({
        text: seg.text,
        startSecond: seg.start,
        endSecond: seg.end,
      })),
      language: result.language,
      durationInSeconds: result.duration,
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
  imageModel(modelId: ImageModelId): ImageModelV3;
  transcriptionModel(modelId: TranscriptionModelId): TranscriptionModelV3;
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

  // add imageModel method
  provider.imageModel = (modelId: ImageModelId): ImageModelV3 =>
    new OpenAIImageModel(modelId, {
      apiKey: settings.apiKey,
      baseURL: settings.baseURL,
    });

  // add transcriptionModel method
  provider.transcriptionModel = (
    modelId: TranscriptionModelId,
  ): TranscriptionModelV3 =>
    new OpenAITranscriptionModel(modelId, {
      apiKey: settings.apiKey,
      baseURL: settings.baseURL,
    });

  return provider;
}

export const openai = createOpenAI();
