import {
  createGoogleGenerativeAI,
  type GoogleGenerativeAIProviderSettings,
} from "@ai-sdk/google";
import {
  type EmbeddingModelV3,
  type ImageModelV3,
  type ImageModelV3CallOptions,
  type LanguageModelV3,
  NoSuchModelError,
  type ProviderV3,
  type SharedV3Warning,
} from "@ai-sdk/provider";
import { GoogleGenAI } from "@google/genai";
import { generateText } from "ai";
import type { VideoModelV3, VideoModelV3CallOptions } from "../video-model";

// re-export base types
export type { GoogleGenerativeAIProviderSettings };

// ============================================================================
// Image Models
// ============================================================================

const IMAGE_MODELS: Record<string, string> = {
  "gemini-2.0-flash-exp-image-generation":
    "gemini-2.0-flash-exp-image-generation",
  "gemini-2-flash-image": "gemini-2.0-flash-exp-image-generation",
  "nano-banana-pro": "gemini-2.0-flash-exp-image-generation",
  "nano-banana-pro/edit": "gemini-2.0-flash-exp-image-generation",
};

const MODELS_WITH_ASPECT_RATIO = new Set(["imagen-3.0-generate-002"]);

class GoogleImageModel implements ImageModelV3 {
  readonly specificationVersion = "v3" as const;
  readonly provider = "google";
  readonly modelId: string;
  readonly maxImagesPerCall = 1;

  private apiKey: string;

  constructor(modelId: string, options: { apiKey?: string } = {}) {
    this.modelId = modelId;
    this.apiKey =
      options.apiKey ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "";
  }

  async doGenerate(options: ImageModelV3CallOptions) {
    const { prompt, aspectRatio, files, providerOptions } = options;
    const warnings: SharedV3Warning[] = [];

    const model = IMAGE_MODELS[this.modelId] ?? this.modelId;

    const content: Array<
      { type: "text"; text: string } | { type: "image"; image: Buffer | URL }
    > = [{ type: "text", text: prompt ?? "" }];

    // add input images if provided
    if (files && files.length > 0) {
      for (const file of files) {
        if (file.type === "file") {
          const data =
            typeof file.data === "string"
              ? Buffer.from(file.data, "base64")
              : Buffer.from(file.data);
          content.push({ type: "image", image: data });
        } else {
          content.push({ type: "image", image: new URL(file.url) });
        }
      }
    }

    // create google provider with api key
    const googleProvider = createGoogleGenerativeAI({
      apiKey: this.apiKey,
    });

    // google returns generated images in result.files[] via generateText
    const googleOptions = (providerOptions?.google ?? {}) as Record<
      string,
      unknown
    >;
    const imageConfig = (googleOptions.imageConfig ?? {}) as Record<
      string,
      unknown
    >;

    const result = await generateText({
      model: googleProvider(model) as unknown as Parameters<
        typeof generateText
      >[0]["model"],
      messages: [
        {
          role: "user",
          content,
        },
      ],
      providerOptions: {
        google: {
          ...googleOptions,
          responseModalities: ["TEXT", "IMAGE"],
          ...(MODELS_WITH_ASPECT_RATIO.has(model) && aspectRatio
            ? { imageConfig: { aspectRatio } }
            : {}),
        },
      },
    });

    const imageFiles = result.files?.filter((file) =>
      file.mediaType?.startsWith("image/"),
    );

    if (!imageFiles || imageFiles.length === 0) {
      throw new Error(
        `No images generated. Model response: ${result.text?.slice(0, 200) || "(no text)"}`,
      );
    }

    const images = imageFiles.map((file) => {
      const bytes =
        typeof file.base64 === "string"
          ? Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0))
          : new Uint8Array(0);
      return bytes;
    });

    if (options.seed !== undefined) {
      warnings.push({
        type: "unsupported",
        feature: "seed",
        details: "Seed is not supported by Google image generation",
      });
    }

    if (options.size !== undefined) {
      warnings.push({
        type: "unsupported",
        feature: "size",
        details: "Use aspectRatio instead for Google image generation",
      });
    }

    if (aspectRatio && !MODELS_WITH_ASPECT_RATIO.has(model)) {
      warnings.push({
        type: "unsupported",
        feature: "aspectRatio",
        details: `aspectRatio not supported by ${model}`,
      });
    }

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

// ============================================================================
// Video Models
// ============================================================================

const VIDEO_MODELS: Record<string, string> = {
  "veo-3.1": "veo-3.1-generate-preview",
  "veo-3": "veo-3.0-generate-preview",
  "veo-3-fast": "veo-3.0-fast-generate-001",
  "veo-2": "veo-2.0-generate-001",
};

class GoogleVideoModel implements VideoModelV3 {
  readonly specificationVersion = "v3" as const;
  readonly provider = "google";
  readonly modelId: string;
  readonly maxVideosPerCall = 1;

  private client: GoogleGenAI;

  constructor(modelId: string, options: { apiKey?: string } = {}) {
    this.modelId = modelId;
    const apiKey =
      options.apiKey ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "";
    this.client = new GoogleGenAI({ apiKey });
  }

  async doGenerate(options: VideoModelV3CallOptions) {
    const {
      prompt,
      duration,
      aspectRatio,
      fps,
      seed,
      files,
      providerOptions,
      abortSignal,
    } = options;
    const warnings: SharedV3Warning[] = [];

    // resolve model endpoint
    const model = VIDEO_MODELS[this.modelId] ?? this.modelId;

    // build config
    const config: Record<string, unknown> = {
      numberOfVideos: 1,
      ...(providerOptions?.google as Record<string, unknown>),
    };

    if (aspectRatio) {
      config.aspectRatio = aspectRatio;
    }

    if (duration) {
      config.durationSeconds = duration;
    }

    if (fps) {
      config.fps = fps;
    }

    if (seed !== undefined) {
      config.seed = seed;
    }

    // handle image input for image-to-video
    let image: { data: string; mimeType: string } | undefined;
    if (files && files.length > 0) {
      const imageFile = files.find((f) => {
        if (f.type === "file") return f.mediaType?.startsWith("image/");
        return /\.(jpg|jpeg|png|webp)$/i.test(f.url);
      });

      if (imageFile) {
        if (imageFile.type === "file") {
          const base64 =
            typeof imageFile.data === "string"
              ? imageFile.data
              : Buffer.from(imageFile.data).toString("base64");
          image = {
            data: base64,
            mimeType: imageFile.mediaType ?? "image/png",
          };
        } else {
          // download image from URL
          const response = await fetch(imageFile.url, { signal: abortSignal });
          const buffer = await response.arrayBuffer();
          const base64 = Buffer.from(buffer).toString("base64");
          const mimeType = response.headers.get("content-type") ?? "image/png";
          image = { data: base64, mimeType };
        }
      }
    }

    // start video generation operation
    let operation = await this.client.models.generateVideos({
      model,
      prompt,
      image,
      config,
    });

    console.log(`[google] video generation started: ${operation.name}`);

    // poll for completion
    while (!operation.done) {
      if (abortSignal?.aborted) {
        throw new Error("Video generation aborted");
      }

      await new Promise((resolve) => setTimeout(resolve, 10000));
      operation = await this.client.operations.getVideosOperation({
        operation,
      });

      if (operation.metadata?.progress) {
        console.log(`[google] progress: ${operation.metadata.progress}%`);
      }
    }

    // check for errors
    if (operation.error) {
      throw new Error(
        `Google video generation failed: ${operation.error.message}`,
      );
    }

    // download generated videos
    const generatedVideos = operation.response?.generatedVideos;
    if (!generatedVideos || generatedVideos.length === 0) {
      throw new Error("No videos generated by Google model");
    }

    const videos: Uint8Array[] = [];
    for (const video of generatedVideos) {
      const videoUri = video.video?.uri;
      if (!videoUri) continue;

      // append api key to URI for authentication
      const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "";
      const videoUrl = `${videoUri}&key=${apiKey}`;

      const response = await fetch(videoUrl, { signal: abortSignal });
      if (!response.ok) {
        throw new Error(`Failed to download video: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      videos.push(new Uint8Array(buffer));
    }

    if (videos.length === 0) {
      throw new Error("Failed to download any videos from Google");
    }

    // warn about unsupported options
    if (options.resolution !== undefined) {
      warnings.push({
        type: "unsupported",
        feature: "resolution",
        details:
          "Use aspectRatio instead. Google Veo determines resolution automatically.",
      });
    }

    return {
      videos,
      warnings,
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
        headers: undefined,
      },
    };
  }
}

// ============================================================================
// Provider
// ============================================================================

export interface GoogleProviderSettings {
  apiKey?: string;
}

export interface GoogleProvider extends ProviderV3 {
  imageModel(modelId: string): ImageModelV3;
  videoModel(modelId: string): VideoModelV3;
}

export function createGoogle(
  settings: GoogleProviderSettings = {},
): GoogleProvider {
  const apiKey = settings.apiKey ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  return {
    specificationVersion: "v3",
    imageModel(modelId: string): GoogleImageModel {
      return new GoogleImageModel(modelId, { apiKey });
    },
    videoModel(modelId: string): GoogleVideoModel {
      return new GoogleVideoModel(modelId, { apiKey });
    },
    languageModel(modelId: string): LanguageModelV3 {
      throw new NoSuchModelError({
        modelId,
        modelType: "languageModel",
      });
    },
    embeddingModel(modelId: string): EmbeddingModelV3 {
      throw new NoSuchModelError({
        modelId,
        modelType: "embeddingModel",
      });
    },
  };
}

export const google = createGoogle();
