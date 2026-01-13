import type {
  EmbeddingModelV3,
  ImageModelV3,
  ImageModelV3CallOptions,
  ImageModelV3File,
  LanguageModelV3,
  ProviderV3,
  SharedV3Warning,
  TranscriptionModelV3,
  TranscriptionModelV3CallOptions,
} from "@ai-sdk/provider";
import { fal } from "@fal-ai/client";
import type {
  VideoModelV3,
  VideoModelV3CallOptions,
  VideoModelV3File,
} from "./video-model";

const VIDEO_MODELS: Record<string, { t2v: string; i2v: string }> = {
  "kling-v2.5": {
    t2v: "fal-ai/kling-video/v2.5-turbo/pro/text-to-video",
    i2v: "fal-ai/kling-video/v2.5-turbo/pro/image-to-video",
  },
  "kling-v2.1": {
    t2v: "fal-ai/kling-video/v2.1/pro/text-to-video",
    i2v: "fal-ai/kling-video/v2.1/pro/image-to-video",
  },
  "kling-v2": {
    t2v: "fal-ai/kling-video/v2/master/text-to-video",
    i2v: "fal-ai/kling-video/v2/master/image-to-video",
  },
  "wan-2.5": {
    t2v: "fal-ai/wan-25/text-to-video",
    i2v: "fal-ai/wan-25/image-to-video",
  },
  "wan-2.5-preview": {
    t2v: "fal-ai/wan-25-preview/text-to-video",
    i2v: "fal-ai/wan-25-preview/image-to-video",
  },
  minimax: {
    t2v: "fal-ai/minimax-video/text-to-video",
    i2v: "fal-ai/minimax-video/image-to-video",
  },
};

const IMAGE_MODELS: Record<string, string> = {
  "flux-pro": "fal-ai/flux-pro/v1.1",
  "flux-dev": "fal-ai/flux/dev",
  "flux-schnell": "fal-ai/flux/schnell",
  "recraft-v3": "fal-ai/recraft/v3/text-to-image",
  "nano-banana-pro": "fal-ai/nano-banana-pro",
};

const TRANSCRIPTION_MODELS: Record<string, string> = {
  whisper: "fal-ai/whisper",
  "whisper-large-v3": "fal-ai/whisper",
};

async function fileToUrl(
  file: VideoModelV3File | ImageModelV3File,
): Promise<string> {
  if ("url" in file && file.type === "url") {
    return file.url;
  }

  const data = file.data;
  const bytes =
    typeof data === "string"
      ? Uint8Array.from(atob(data), (c) => c.charCodeAt(0))
      : data;

  return fal.storage.upload(new Blob([bytes]));
}

async function uploadBuffer(buffer: ArrayBuffer): Promise<string> {
  return fal.storage.upload(new Blob([buffer]));
}

class FalVideoModel implements VideoModelV3 {
  readonly specificationVersion = "v3" as const;
  readonly provider = "fal";
  readonly modelId: string;
  readonly maxVideosPerCall = 1;

  constructor(modelId: string) {
    this.modelId = modelId;
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

    const hasImageInput = files?.some((f) => f.mediaType?.startsWith("image/"));
    const endpoint = this.resolveEndpoint(hasImageInput ?? false);

    const input: Record<string, unknown> = {
      prompt,
      duration: duration ?? 5,
      ...(providerOptions?.fal ?? {}),
    };

    if (hasImageInput && files) {
      const imageFile = files.find((f) => f.mediaType?.startsWith("image/"));
      if (imageFile) {
        input.image_url = await fileToUrl(imageFile);
      }
    } else {
      input.aspect_ratio = aspectRatio ?? "16:9";
    }

    // Handle audio input for audio-reactive video generation
    const audioFile = files?.find((f) => f.mediaType?.startsWith("audio/"));
    if (audioFile) {
      input.audio_url = await fileToUrl(audioFile);
    }

    if (options.seed !== undefined) {
      warnings.push({
        type: "unsupported",
        feature: "seed",
        details: "Seed is not supported by this model",
      });
    }

    if (options.resolution !== undefined) {
      warnings.push({
        type: "unsupported",
        feature: "resolution",
        details: "Use aspectRatio instead",
      });
    }

    if (options.fps !== undefined) {
      warnings.push({
        type: "unsupported",
        feature: "fps",
        details: "FPS is not configurable for this model",
      });
    }

    const result = await fal.subscribe(endpoint, {
      input,
      logs: true,
    });

    const data = result.data as { video?: { url?: string } };
    const videoUrl = data?.video?.url;

    if (!videoUrl) {
      throw new Error("No video URL in fal response");
    }

    const videoResponse = await fetch(videoUrl, { signal: abortSignal });
    const videoBuffer = await videoResponse.arrayBuffer();

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

  private resolveEndpoint(hasImage: boolean): string {
    if (this.modelId.startsWith("raw:")) {
      return this.modelId.slice(4);
    }

    const mapping = VIDEO_MODELS[this.modelId];
    if (mapping) {
      return hasImage ? mapping.i2v : mapping.t2v;
    }

    return this.modelId;
  }
}

class FalImageModel implements ImageModelV3 {
  readonly specificationVersion = "v3" as const;
  readonly provider = "fal";
  readonly modelId: string;
  readonly maxImagesPerCall = 4;

  constructor(modelId: string) {
    this.modelId = modelId;
  }

  async doGenerate(options: ImageModelV3CallOptions) {
    const {
      prompt,
      n,
      size,
      aspectRatio,
      seed,
      files,
      providerOptions,
      abortSignal,
    } = options;
    const warnings: SharedV3Warning[] = [];

    const endpoint = this.resolveEndpoint();

    const input: Record<string, unknown> = {
      prompt,
      num_images: n,
      ...(providerOptions?.fal ?? {}),
    };

    if (size) {
      input.image_size = size;
    }

    if (aspectRatio) {
      input.aspect_ratio = aspectRatio;
    }

    if (seed !== undefined) {
      input.seed = seed;
    }

    const hasFiles = files && files.length > 0;
    if (hasFiles) {
      input.image_urls = await Promise.all(files.map((f) => fileToUrl(f)));
    }

    const hasImageUrls =
      hasFiles ||
      !!(providerOptions?.fal as Record<string, unknown>)?.image_urls;
    const finalEndpoint = this.resolveEndpoint(hasImageUrls);

    const result = await fal.subscribe(finalEndpoint, {
      input,
      logs: true,
    });

    const data = result.data as { images?: Array<{ url?: string }> };
    const images = data?.images ?? [];

    if (images.length === 0) {
      throw new Error("No images in fal response");
    }

    const imageBuffers = await Promise.all(
      images.map(async (img) => {
        const response = await fetch(img.url!, { signal: abortSignal });
        return new Uint8Array(await response.arrayBuffer());
      }),
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

  private resolveEndpoint(hasFiles = false): string {
    if (this.modelId.startsWith("raw:")) {
      return this.modelId.slice(4);
    }

    const baseEndpoint = IMAGE_MODELS[this.modelId] ?? this.modelId;

    if (hasFiles && this.modelId === "nano-banana-pro") {
      return "fal-ai/nano-banana-pro/edit";
    }

    return baseEndpoint;
  }
}

class FalTranscriptionModel implements TranscriptionModelV3 {
  readonly specificationVersion = "v3" as const;
  readonly provider = "fal";
  readonly modelId: string;

  constructor(modelId: string) {
    this.modelId = modelId;
  }

  async doGenerate(options: TranscriptionModelV3CallOptions) {
    const { audio, mediaType, providerOptions, abortSignal } = options;
    const warnings: SharedV3Warning[] = [];

    const endpoint = TRANSCRIPTION_MODELS[this.modelId] ?? this.modelId;

    const audioBytes =
      typeof audio === "string"
        ? Uint8Array.from(atob(audio), (c) => c.charCodeAt(0))
        : audio;

    const audioUrl = await uploadBuffer(audioBytes.buffer as ArrayBuffer);

    const input: Record<string, unknown> = {
      audio_url: audioUrl,
      task: "transcribe",
      ...(providerOptions?.fal ?? {}),
    };

    const result = await fal.subscribe(endpoint, {
      input,
      logs: true,
    });

    const data = result.data as {
      text?: string;
      chunks?: Array<{ timestamp: [number, number]; text: string }>;
      language?: string;
    };

    return {
      text: data?.text ?? "",
      segments: (data?.chunks ?? []).map((chunk) => ({
        text: chunk.text,
        startSecond: chunk.timestamp[0],
        endSecond: chunk.timestamp[1],
      })),
      language: data?.language,
      durationInSeconds: undefined,
      warnings,
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
        headers: undefined,
      },
    };
  }
}

export interface FalProviderSettings {
  apiKey?: string;
}

export interface FalProvider extends ProviderV3 {
  videoModel(modelId: string): VideoModelV3;
  imageModel(modelId: string): ImageModelV3;
  transcriptionModel(modelId: string): TranscriptionModelV3;
}

export function createFal(settings: FalProviderSettings = {}): FalProvider {
  if (settings.apiKey) {
    fal.config({ credentials: settings.apiKey });
  }

  return {
    specificationVersion: "v3",
    videoModel(modelId: string): FalVideoModel {
      return new FalVideoModel(modelId);
    },
    imageModel(modelId: string): FalImageModel {
      return new FalImageModel(modelId);
    },
    transcriptionModel(modelId: string): FalTranscriptionModel {
      return new FalTranscriptionModel(modelId);
    },
    languageModel(modelId: string): LanguageModelV3 {
      throw new Error("Function not implemented.");
    },
    embeddingModel(modelId: string): EmbeddingModelV3 {
      throw new Error("Function not implemented.");
    },
  };
}

export const fal_provider = createFal();
export { fal_provider as fal };
