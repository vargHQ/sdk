import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ImageModelV3 } from "@ai-sdk/provider";
import type { generateImage } from "ai";
import type { VideoModelV3CallOptions } from "../video-model";
import type { VideoModelMiddleware } from "./wrap-video-model";

export interface PrerenderFallbackOptions {
  /**
   * Image model to use for generating still frames from text-to-video prompts.
   * When a Video element has only a text prompt (no input images), this model
   * generates the placeholder image that becomes the still frame.
   */
  imageModel: ImageModelV3;

  /**
   * The generateImage function to use (should be the cached version).
   */
  generateImageFn: typeof generateImage;

  /**
   * Callback when a video is replaced with a still frame.
   */
  onPrerender?: (prompt: string, hasInputImage: boolean) => void;
}

/**
 * Creates a still-frame video from an image using ffmpeg.
 * The video holds the image for the specified duration.
 */
async function imageToStillVideo(
  imageData: Uint8Array,
  duration: number,
  resolution?: string,
): Promise<Uint8Array> {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2);
  const imgPath = join(tmpdir(), `prerender_img_${ts}_${rand}.png`);
  const outPath = join(tmpdir(), `prerender_vid_${ts}_${rand}.mp4`);

  try {
    await Bun.write(imgPath, imageData);

    // Parse resolution for scaling, default to 1080x1920
    let scaleFilter = "";
    if (resolution) {
      const [w, h] = resolution.split("x").map(Number);
      if (w && h) {
        scaleFilter = `-vf scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2`;
      }
    }

    const { $ } = await import("bun");

    const args = [
      "ffmpeg",
      "-y",
      "-loop",
      "1",
      "-i",
      imgPath,
      "-t",
      String(duration),
      "-r",
      "30",
      ...(scaleFilter ? scaleFilter.split(" ") : []),
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-pix_fmt",
      "yuv420p",
      "-tune",
      "stillimage",
      outPath,
    ];

    const result = await $`${args}`.quiet().nothrow();

    if (result.exitCode !== 0) {
      const stderr = result.stderr.toString().trim();
      throw new Error(
        `ffmpeg still-frame failed (exit ${result.exitCode}): ${stderr || "unknown error"}`,
      );
    }

    const data = await Bun.file(outPath).bytes();
    return new Uint8Array(data);
  } finally {
    await unlink(imgPath).catch(() => {});
    await unlink(outPath).catch(() => {});
  }
}

/**
 * Extracts the first image file from VideoModelV3CallOptions.files.
 * Returns the image data if found, undefined otherwise.
 */
async function extractFirstImage(
  params: VideoModelV3CallOptions,
): Promise<Uint8Array | undefined> {
  if (!params.files) return undefined;

  for (const file of params.files) {
    if (file.type === "file" && file.mediaType?.startsWith("image/")) {
      if (file.data instanceof Uint8Array) {
        return file.data;
      }
      if (typeof file.data === "string") {
        // base64
        return Uint8Array.from(atob(file.data), (c) => c.charCodeAt(0));
      }
    }
    if (file.type === "url") {
      // Fetch the URL to get binary data
      try {
        const response = await fetch(file.url);
        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.startsWith("image/")) {
          return new Uint8Array(await response.arrayBuffer());
        }
      } catch {
        // Skip URLs that can't be fetched
      }
    }
  }

  return undefined;
}

/**
 * Middleware that replaces video generation with still-frame images.
 *
 * - For i2v (image-to-video): uses the input image as the still frame
 * - For t2v (text-to-video): generates an image using the configured image
 *   model and uses it as the still frame
 *
 * The resulting video has the exact duration specified in the clip,
 * making it suitable for verifying visual-audio sync before expensive
 * video generation.
 */
export function prerenderFallbackMiddleware(
  options: PrerenderFallbackOptions,
): VideoModelMiddleware {
  const { imageModel, generateImageFn, onPrerender } = options;

  return {
    wrapGenerate: async ({ doGenerate, params, model }) => {
      const duration = params.duration ?? 3;

      // Try to extract an existing image from the input files (i2v case)
      const inputImage = await extractFirstImage(params);

      let frameImage: Uint8Array;

      if (inputImage) {
        // i2v: use the input image directly as the still frame
        frameImage = inputImage;
        onPrerender?.(params.prompt, true);
      } else {
        // t2v: generate an image from the text prompt
        const prompt = params.prompt || "placeholder";
        onPrerender?.(prompt, false);

        const { images } = await generateImageFn({
          model: imageModel,
          prompt,
          n: 1,
          aspectRatio: params.aspectRatio,
        } as Parameters<typeof generateImage>[0]);

        const firstImage = images[0];
        if (!firstImage?.uint8Array) {
          throw new Error(
            `prerender: image generation returned no data for prompt: ${prompt.slice(0, 80)}`,
          );
        }
        frameImage = firstImage.uint8Array;
      }

      // Create still-frame video with exact duration
      const videoData = await imageToStillVideo(
        frameImage,
        duration,
        params.resolution,
      );

      return {
        videos: [videoData],
        warnings: [
          {
            type: "other" as const,
            message: `prerender: still frame (${inputImage ? "i2v input" : "t2v generated"}, ${duration}s)`,
          },
        ],
        response: {
          timestamp: new Date(),
          modelId: `prerender:${model.modelId}`,
          headers: undefined,
        },
      };
    },
  };
}
