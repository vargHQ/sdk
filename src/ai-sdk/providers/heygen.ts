/**
 * HeyGen AI SDK provider for avatar video generation.
 *
 * Exposes heygen.videoModel("avatar-iv") for use in JSX composition:
 *
 *   import { heygen } from "vargai/ai-sdk";
 *
 *   const talking = Video({
 *     prompt: { text: "Hello world", images: [portrait] },
 *     model: heygen.videoModel("avatar-iv"),
 *     providerOptions: {
 *       heygen: { voice_id: "abc123", expressiveness: "medium" }
 *     },
 *   });
 */

import {
  type EmbeddingModelV3,
  type ImageModelV3,
  type LanguageModelV3,
  NoSuchModelError,
  type ProviderV3,
  type SharedV3Warning,
  type SpeechModelV3,
} from "@ai-sdk/provider";
import type {
  VideoModelV3,
  VideoModelV3CallOptions,
  VideoModelV3File,
} from "../video-model";

const HEYGEN_API_BASE = "https://api.heygen.com";
const HEYGEN_UPLOAD_BASE = "https://upload.heygen.com";

// ---------------------------------------------------------------------------
// HeyGen response types
// ---------------------------------------------------------------------------

interface HeyGenVideoStatusData {
  id: string;
  status: string;
  video_url?: string;
  duration?: number;
  error?: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMediaType(file: VideoModelV3File): string | undefined {
  if ("mediaType" in file && file.mediaType) return file.mediaType;
  return undefined;
}

async function fileToBytes(file: VideoModelV3File): Promise<Uint8Array> {
  if ("data" in file) {
    if (file.data instanceof Uint8Array) return file.data;
    if (typeof file.data === "string") return Buffer.from(file.data, "base64");
  }
  throw new Error("HeyGen: file has no data");
}

/**
 * Upload a file to HeyGen's asset endpoint and return the asset_id.
 */
async function uploadAssetToHeyGen(
  apiKey: string,
  data: Uint8Array,
  contentType: string,
): Promise<string> {
  const res = await fetch(`${HEYGEN_UPLOAD_BASE}/v1/asset`, {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
      "Content-Type": contentType,
    },
    body: data,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`HeyGen asset upload failed (${res.status}): ${errorText}`);
  }

  const json = (await res.json()) as {
    data?: { id?: string };
  };
  const assetId = json.data?.id;
  if (!assetId) throw new Error("HeyGen asset upload returned no asset id");
  return assetId;
}

/**
 * Upload an image as a HeyGen talking photo and return the talking_photo_id.
 * This allows any image to be used as a character in Studio V2 videos.
 */
async function uploadTalkingPhoto(
  apiKey: string,
  data: Uint8Array,
  contentType: string,
): Promise<string> {
  const res = await fetch(`${HEYGEN_UPLOAD_BASE}/v1/talking_photo`, {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
      "Content-Type": contentType,
    },
    body: data,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(
      `HeyGen talking photo upload failed (${res.status}): ${errorText}`,
    );
  }

  const json = (await res.json()) as {
    data?: { talking_photo_id?: string };
  };
  const talkingPhotoId = json.data?.talking_photo_id;
  if (!talkingPhotoId)
    throw new Error("HeyGen talking photo upload returned no talking_photo_id");
  return talkingPhotoId;
}

/**
 * Build the `background` object for a Studio V2 scene.
 * Accepts a URL string (image), a hex color, or a structured object.
 */
function buildBackground(bg: unknown): Record<string, unknown> | undefined {
  if (!bg) return undefined;
  if (typeof bg === "string") {
    if (bg.startsWith("#")) return { type: "color", value: bg };
    return { type: "image", url: bg, fit: "cover" };
  }
  if (typeof bg === "object") return bg as Record<string, unknown>;
  return undefined;
}

/**
 * Poll HeyGen video status until completed or failed.
 */
async function pollVideoStatus(
  apiKey: string,
  videoId: string,
  signal?: AbortSignal,
): Promise<HeyGenVideoStatusData> {
  const maxWait = 600_000; // 10 minutes
  const pollInterval = 5_000; // 5 seconds
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    if (signal?.aborted) throw new Error("HeyGen: aborted");

    const res = await fetch(
      `${HEYGEN_API_BASE}/v1/video_status.get?video_id=${videoId}`,
      {
        headers: {
          "X-Api-Key": apiKey,
          Accept: "application/json",
        },
        ...(signal != null ? { signal } : {}),
      },
    );

    if (!res.ok) {
      throw new Error(`HeyGen status check failed (${res.status})`);
    }

    const body = (await res.json()) as {
      data?: HeyGenVideoStatusData;
    };
    const status = body.data?.status?.toLowerCase();

    if (status === "completed") {
      if (!body.data?.video_url) {
        throw new Error("HeyGen video completed but no video_url in response");
      }
      return body.data;
    }

    if (status === "failed") {
      throw new Error(
        `HeyGen video generation failed: ${body.data?.error ?? "unknown error"}`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error(`HeyGen video generation timed out after ${maxWait / 1000}s`);
}

// ---------------------------------------------------------------------------
// Video model
// ---------------------------------------------------------------------------

class HeyGenVideoModel implements VideoModelV3 {
  readonly specificationVersion = "v3" as const;
  readonly provider = "heygen";
  readonly modelId: string;
  readonly maxVideosPerCall = 1;

  private apiKey: string;

  constructor(modelId: string, apiKey: string) {
    this.modelId = modelId;
    this.apiKey = apiKey;
  }

  async doGenerate(options: VideoModelV3CallOptions) {
    const { prompt, files, providerOptions, abortSignal } = options;
    const warnings: SharedV3Warning[] = [];

    const heygenOpts = (providerOptions?.heygen ?? {}) as Record<
      string,
      unknown
    >;

    // ---- Resolve character source ----
    const avatarId = heygenOpts.avatar_id as string | undefined;
    const talkingPhotoId = heygenOpts.talking_photo_id as string | undefined;
    const voiceId = heygenOpts.voice_id as string | undefined;

    // If an image file is provided and no avatar/talking_photo specified,
    // upload it as a talking photo for use in Studio V2
    let resolvedTalkingPhotoId = talkingPhotoId;
    if (!avatarId && !talkingPhotoId) {
      const imageFile = files?.find((f) =>
        getMediaType(f)?.startsWith("image/"),
      );
      if (imageFile) {
        const bytes = await fileToBytes(imageFile);
        const contentType = getMediaType(imageFile) ?? "image/jpeg";
        resolvedTalkingPhotoId = await uploadTalkingPhoto(
          this.apiKey,
          bytes,
          contentType,
        );
      }
    }

    // Upload audio file if present (external audio mode)
    let audioAssetId: string | undefined;
    const audioFile = files?.find((f) => getMediaType(f)?.startsWith("audio/"));
    if (audioFile) {
      const audioBytes = await fileToBytes(audioFile);
      const audioContentType = getMediaType(audioFile) ?? "audio/mpeg";
      audioAssetId = await uploadAssetToHeyGen(
        this.apiKey,
        audioBytes,
        audioContentType,
      );
    }

    if (prompt && voiceId === undefined && !audioFile) {
      warnings.push({
        type: "other",
        message:
          "HeyGen requires voice_id when using script mode. Pass it via providerOptions.heygen.voice_id",
      });
    }

    // ---- Always use Studio V2 (POST /v2/video/generate) ----
    // Works for both pre-registered avatars and uploaded talking photos.

    // Build character object
    const character: Record<string, unknown> = {};
    if (avatarId) {
      character.type = "avatar";
      character.avatar_id = avatarId;
      character.avatar_style = (heygenOpts.avatar_style as string) ?? "normal";
    } else if (resolvedTalkingPhotoId) {
      character.type = "talking_photo";
      character.talking_photo_id = resolvedTalkingPhotoId;
      if (heygenOpts.talking_style)
        character.talking_style = heygenOpts.talking_style;
      if (heygenOpts.use_avatar_iv_model)
        character.use_avatar_iv_model = heygenOpts.use_avatar_iv_model;
      if (heygenOpts.matting) character.matting = heygenOpts.matting;
    }

    // Build voice object
    const voice: Record<string, unknown> = {};
    if (audioAssetId) {
      voice.type = "audio";
      voice.audio_asset_id = audioAssetId;
    } else if (prompt && voiceId) {
      voice.type = "text";
      voice.input_text = prompt;
      voice.voice_id = voiceId;
      if (heygenOpts.speed) voice.speed = heygenOpts.speed;
      if (heygenOpts.emotion) voice.emotion = heygenOpts.emotion;
    }

    // Build background object
    const background = buildBackground(heygenOpts.background);

    // Build scene
    const scene: Record<string, unknown> = { character, voice };
    if (background) scene.background = background;

    // Aspect ratio → dimension
    const aspectRatio =
      (heygenOpts.aspect_ratio as string | undefined) ?? options.aspectRatio;
    const dim =
      aspectRatio === "9:16"
        ? { width: 720, height: 1280 }
        : { width: 1280, height: 720 };

    const studioPayload: Record<string, unknown> = {
      video_inputs: [scene],
      dimension: dim,
    };
    if (heygenOpts.callback_url)
      studioPayload.callback_url = heygenOpts.callback_url;
    if (heygenOpts.title) studioPayload.title = heygenOpts.title;
    if (heygenOpts.caption) studioPayload.caption = heygenOpts.caption;

    const submitUrl = `${HEYGEN_API_BASE}/v2/video/generate`;
    const submitBody = JSON.stringify(studioPayload);

    // ---- Submit ----
    const submitRes = await fetch(submitUrl, {
      method: "POST",
      headers: {
        "X-Api-Key": this.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: submitBody,
      ...(abortSignal != null ? { signal: abortSignal } : {}),
    });

    if (!submitRes.ok) {
      const errorText = await submitRes.text();
      throw new Error(
        `HeyGen video generation failed (${submitRes.status}): ${errorText}`,
      );
    }

    const submitData = (await submitRes.json()) as {
      data?: { video_id?: string };
      video_id?: string;
    };
    const videoId = submitData.data?.video_id ?? submitData.video_id;
    if (!videoId) throw new Error("HeyGen returned no video_id");

    // ---- Poll for completion ----
    const statusData = await pollVideoStatus(this.apiKey, videoId, abortSignal);

    // ---- Download video ----
    const videoRes = await fetch(statusData.video_url!, {
      ...(abortSignal != null ? { signal: abortSignal } : {}),
    });
    if (!videoRes.ok) {
      throw new Error(`Failed to download HeyGen video (${videoRes.status})`);
    }
    const videoBytes = new Uint8Array(await videoRes.arrayBuffer());

    return {
      videos: [videoBytes],
      warnings,
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
        headers: undefined,
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Provider factory
// ---------------------------------------------------------------------------

export interface HeyGenProviderSettings {
  apiKey?: string;
}

export interface HeyGenProvider extends ProviderV3 {
  videoModel(modelId?: string): VideoModelV3;
}

export function createHeyGen(
  settings: HeyGenProviderSettings = {},
): HeyGenProvider {
  const apiKey = settings.apiKey ?? process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    throw new Error("HEYGEN_API_KEY not set");
  }

  return {
    specificationVersion: "v3",
    videoModel(modelId = "avatar-iv") {
      return new HeyGenVideoModel(modelId, apiKey);
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
    imageModel(modelId: string): ImageModelV3 {
      throw new NoSuchModelError({
        modelId,
        modelType: "imageModel",
      });
    },
    speechModel(modelId: string): SpeechModelV3 {
      throw new NoSuchModelError({
        modelId,
        modelType: "speechModel",
      });
    },
  };
}

// Lazy singleton (same pattern as elevenlabs)
let _heygen: HeyGenProvider | undefined;
export const heygen = new Proxy({} as HeyGenProvider, {
  get(_, prop) {
    if (!_heygen) {
      _heygen = createHeyGen();
    }
    return _heygen[prop as keyof HeyGenProvider];
  },
});
