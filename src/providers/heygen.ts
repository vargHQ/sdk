/**
 * HeyGen provider for AI avatar video generation
 * Supports text-to-video with talking avatars, photo-to-video lipsync,
 * and pre-built avatar catalog.
 *
 * HeyGen API docs: https://docs.heygen.com/reference
 */

import type { JobStatusUpdate, ProviderConfig } from "../core/schema/types";
import { BaseProvider } from "./base";

const HEYGEN_API_BASE = "https://api.heygen.com";
const HEYGEN_UPLOAD_BASE = "https://upload.heygen.com";

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

interface HeyGenVideoResponse {
  video_id: string;
  status?: string;
}

interface HeyGenVideoStatusResponse {
  code: number;
  data: {
    id: string;
    status: string;
    video_url?: string;
    video_url_caption?: string;
    thumbnail_url?: string;
    gif_url?: string;
    caption_url?: string;
    duration?: number;
    error?: string | null;
    callback_id?: string;
    created_at?: number;
  };
  message: string;
}

interface HeyGenVoice {
  voice_id: string;
  name: string;
  language: string;
  gender: string;
  preview_audio?: string;
  support_pause?: boolean;
  emotion_support?: boolean;
  support_interactive_avatar?: boolean;
  support_locale?: boolean;
}

interface HeyGenAvatar {
  avatar_id: string;
  avatar_name: string;
  gender?: string;
  preview_image_url?: string;
  preview_video_url?: string;
  tags?: string[];
}

interface HeyGenTalkingPhoto {
  talking_photo_id: string;
  talking_photo_name: string;
  preview_image_url?: string;
}

interface HeyGenAssetUploadResponse {
  code: number;
  data: {
    id: string;
    name: string;
    file_type: string;
    url: string;
    image_key?: string;
  };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class HeyGenProvider extends BaseProvider {
  readonly name = "heygen";
  private apiKey: string;

  constructor(config?: ProviderConfig) {
    super({
      timeout: 600000, // 10 minutes default (avatar videos can take 30-120s)
      ...config,
    });
    this.apiKey = config?.apiKey || process.env.HEYGEN_API_KEY || "";
  }

  // ---- Provider interface ----

  async submit(
    _model: string,
    inputs: Record<string, unknown>,
    _config?: ProviderConfig,
  ): Promise<string> {
    const script = inputs.script as string | undefined;
    const voiceId = inputs.voice_id as string | undefined;
    const avatarId = inputs.avatar_id as string | undefined;
    const talkingPhotoId = inputs.talking_photo_id as string | undefined;
    const audioUrl = inputs.audio_url as string | undefined;
    const audioAssetId = inputs.audio_asset_id as string | undefined;
    const aspectRatio = inputs.aspect_ratio as string | undefined;
    const callbackUrl = inputs.callback_url as string | undefined;
    const title = inputs.title as string | undefined;
    const background = inputs.background as
      | Record<string, unknown>
      | string
      | undefined;

    // Always use Studio V2 (POST /v2/video/generate)
    // Works for avatars, talking photos, and uploaded images

    // Build character
    const character: Record<string, unknown> = {};
    if (avatarId) {
      character.type = "avatar";
      character.avatar_id = avatarId;
      character.avatar_style = (inputs.avatar_style as string) ?? "normal";
    } else if (talkingPhotoId) {
      character.type = "talking_photo";
      character.talking_photo_id = talkingPhotoId;
      if (inputs.talking_style) character.talking_style = inputs.talking_style;
      if (inputs.matting) character.matting = inputs.matting;
    }

    // Build voice
    const voice: Record<string, unknown> = {};
    if (script && voiceId) {
      voice.type = "text";
      voice.input_text = script;
      voice.voice_id = voiceId;
      if (inputs.speed) voice.speed = inputs.speed;
      if (inputs.emotion) voice.emotion = inputs.emotion;
    } else if (audioUrl) {
      voice.type = "audio";
      voice.audio_url = audioUrl;
    } else if (audioAssetId) {
      voice.type = "audio";
      voice.audio_asset_id = audioAssetId;
    }

    // Build background
    let bg: Record<string, unknown> | undefined;
    if (typeof background === "string") {
      bg = background.startsWith("#")
        ? { type: "color", value: background }
        : { type: "image", url: background, fit: "cover" };
    } else if (background) {
      bg = background;
    }

    // Build scene
    const scene: Record<string, unknown> = { character, voice };
    if (bg) scene.background = bg;

    // Dimension from aspect ratio
    const dim =
      aspectRatio === "9:16"
        ? { width: 720, height: 1280 }
        : { width: 1280, height: 720 };

    const payload: Record<string, unknown> = {
      video_inputs: [scene],
      dimension: dim,
    };
    if (callbackUrl) payload.callback_url = callbackUrl;
    if (title) payload.title = title;

    console.log("[heygen] submitting via Studio V2...");

    const response = await fetch(`${HEYGEN_API_BASE}/v2/video/generate`, {
      method: "POST",
      headers: {
        "X-Api-Key": this.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `heygen submit failed (${response.status}): ${errorText}`,
      );
    }

    const data = (await response.json()) as {
      data?: HeyGenVideoResponse;
      video_id?: string;
      error?: unknown;
    };
    const videoId = data.data?.video_id ?? data.video_id;

    if (!videoId) {
      throw new Error("no video_id in heygen response");
    }

    console.log(`[heygen] video submitted: ${videoId}`);
    return videoId;
  }

  async getStatus(jobId: string): Promise<JobStatusUpdate> {
    const res = await fetch(
      `${HEYGEN_API_BASE}/v1/video_status.get?video_id=${jobId}`,
      {
        method: "GET",
        headers: {
          "X-Api-Key": this.apiKey,
          Accept: "application/json",
        },
      },
    );

    if (!res.ok) {
      throw new Error(`heygen status check failed (${res.status})`);
    }

    const body = (await res.json()) as HeyGenVideoStatusResponse;
    const status = body.data?.status?.toLowerCase();

    const statusMap: Record<string, JobStatusUpdate["status"]> = {
      pending: "queued",
      waiting: "queued",
      processing: "processing",
      completed: "completed",
      failed: "failed",
    };

    return {
      status: statusMap[status] ?? "processing",
      output: body.data?.video_url
        ? { url: body.data.video_url, duration: body.data.duration }
        : undefined,
      error: body.data?.error ?? undefined,
    };
  }

  async getResult(jobId: string): Promise<unknown> {
    const res = await fetch(
      `${HEYGEN_API_BASE}/v1/video_status.get?video_id=${jobId}`,
      {
        method: "GET",
        headers: {
          "X-Api-Key": this.apiKey,
          Accept: "application/json",
        },
      },
    );

    if (!res.ok) {
      throw new Error(`heygen result fetch failed (${res.status})`);
    }

    const body = (await res.json()) as HeyGenVideoStatusResponse;
    return body.data;
  }

  // ---- Convenience methods ----

  /**
   * Generate an avatar video from script text using Avatar IV.
   * This is the simplest path: script + voice + avatar/image = video.
   */
  async createAvatarVideo(args: {
    script: string;
    voiceId: string;
    avatarId?: string;
    imageUrl?: string;
    motionPrompt?: string;
    expressiveness?: "low" | "medium" | "high";
    aspectRatio?: "16:9" | "9:16";
    resolution?: "720p" | "1080p";
  }) {
    console.log("[heygen] starting avatar video generation...");

    const videoId = await this.submit("avatar-iv", {
      script: args.script,
      voice_id: args.voiceId,
      ...(args.avatarId ? { avatar_id: args.avatarId } : {}),
      ...(args.imageUrl ? { image_url: args.imageUrl } : {}),
      ...(args.motionPrompt ? { motion_prompt: args.motionPrompt } : {}),
      ...(args.expressiveness ? { expressiveness: args.expressiveness } : {}),
      ...(args.aspectRatio ? { aspect_ratio: args.aspectRatio } : {}),
      ...(args.resolution ? { resolution: args.resolution } : {}),
    });

    const result = (await this.waitForCompletion(videoId, {
      maxWait: this.config.timeout ?? 600000,
      pollInterval: 5000,
    })) as { url?: string; duration?: number };

    if (!result?.url) {
      throw new Error("heygen video completed but no video URL");
    }

    console.log("[heygen] avatar video completed!");
    return { video: { url: result.url, duration: result.duration } };
  }

  /**
   * List available HeyGen voices.
   */
  async listVoices(): Promise<HeyGenVoice[]> {
    console.log("[heygen] fetching voices...");

    const res = await fetch(`${HEYGEN_API_BASE}/v2/voices`, {
      headers: {
        "X-Api-Key": this.apiKey,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(
        `heygen list voices failed (${res.status}): ${errorText}`,
      );
    }

    const data = (await res.json()) as {
      data?: { voices?: HeyGenVoice[] };
      error?: unknown;
    };
    const voices = data.data?.voices ?? [];
    console.log(`[heygen] found ${voices.length} voices`);
    return voices;
  }

  /**
   * List available HeyGen avatars and talking photos.
   */
  async listAvatars(): Promise<{
    avatars: HeyGenAvatar[];
    talkingPhotos: HeyGenTalkingPhoto[];
  }> {
    console.log("[heygen] fetching avatars...");

    const res = await fetch(`${HEYGEN_API_BASE}/v2/avatars`, {
      headers: {
        "X-Api-Key": this.apiKey,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(
        `heygen list avatars failed (${res.status}): ${errorText}`,
      );
    }

    const data = (await res.json()) as {
      data?: {
        avatars?: HeyGenAvatar[];
        talking_photos?: HeyGenTalkingPhoto[];
      };
      error?: unknown;
    };

    const avatars = data.data?.avatars ?? [];
    const talkingPhotos = data.data?.talking_photos ?? [];
    console.log(
      `[heygen] found ${avatars.length} avatars, ${talkingPhotos.length} talking photos`,
    );
    return { avatars, talkingPhotos };
  }

  /**
   * Upload an image as a talking photo to HeyGen.
   * Returns a talking_photo_id that can be used in Studio V2 video generation.
   */
  async uploadTalkingPhoto(
    file: Uint8Array | ArrayBuffer,
    contentType = "image/jpeg",
  ): Promise<string> {
    console.log("[heygen] uploading talking photo...");

    const body = file instanceof Uint8Array ? file : new Uint8Array(file);

    const res = await fetch(`${HEYGEN_UPLOAD_BASE}/v1/talking_photo`, {
      method: "POST",
      headers: {
        "X-Api-Key": this.apiKey,
        "Content-Type": contentType,
      },
      body,
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(
        `heygen talking photo upload failed (${res.status}): ${errorText}`,
      );
    }

    const data = (await res.json()) as {
      data?: { talking_photo_id?: string };
    };
    const talkingPhotoId = data.data?.talking_photo_id;

    if (!talkingPhotoId) {
      throw new Error("no talking_photo_id in heygen upload response");
    }

    console.log(`[heygen] uploaded talking photo: ${talkingPhotoId}`);
    return talkingPhotoId;
  }

  /**
   * Upload an asset (image/audio/video) to HeyGen.
   * Note: uses upload.heygen.com, not api.heygen.com.
   */
  async uploadAsset(
    file: Uint8Array | ArrayBuffer,
    contentType: string,
  ): Promise<{ assetId: string; url: string }> {
    console.log(`[heygen] uploading asset (${contentType})...`);

    const body = file instanceof Uint8Array ? file : new Uint8Array(file);

    const res = await fetch(`${HEYGEN_UPLOAD_BASE}/v1/asset`, {
      method: "POST",
      headers: {
        "X-Api-Key": this.apiKey,
        "Content-Type": contentType,
      },
      body,
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(
        `heygen asset upload failed (${res.status}): ${errorText}`,
      );
    }

    const data = (await res.json()) as HeyGenAssetUploadResponse;
    const assetId = data.data?.id;
    const url = data.data?.url;

    if (!assetId) {
      throw new Error("no asset id in heygen upload response");
    }

    console.log(`[heygen] uploaded asset: ${assetId}`);
    return { assetId, url: url ?? "" };
  }

  /**
   * Get remaining API quota.
   */
  async getRemainingQuota(): Promise<number> {
    const res = await fetch(`${HEYGEN_API_BASE}/v2/user/remaining_quota`, {
      headers: {
        "X-Api-Key": this.apiKey,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`heygen quota check failed (${res.status})`);
    }

    const data = (await res.json()) as {
      data?: { remaining_quota?: number };
    };
    return data.data?.remaining_quota ?? 0;
  }
}

// Export singleton instance
export const heygenProvider = new HeyGenProvider();
