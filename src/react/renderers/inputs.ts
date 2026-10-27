/**
 * Shared input resolution helpers — convert string/Uint8Array/element
 * inputs into raw bytes for generation prompts.
 *
 * Used by image.ts and video.ts (and indirectly by any renderer that
 * accepts image/video/audio inputs).
 */

import type { File } from "../../ai-sdk/file";
import { ResolvedElement } from "../resolved-element";
import type { ImageInput, VargElement } from "../types";
import type { RenderContext } from "./context";
import { renderImage } from "./image";
import { renderSpeech } from "./speech";
import { toFileUrl } from "./utils";

/** Resolve an image input (Uint8Array | path/URL | Image element) to bytes. */
export async function resolveImageInput(
  input: ImageInput,
  ctx: RenderContext,
): Promise<Uint8Array> {
  if (input instanceof Uint8Array) {
    return input;
  }
  if (typeof input === "string") {
    const response = await fetch(toFileUrl(input));
    return new Uint8Array(await response.arrayBuffer());
  }
  const file = await renderImage(input, ctx);
  const data = await file.arrayBuffer();
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  return data;
}

/** Resolve a video input (Uint8Array | path/URL | Video element) to bytes. */
export async function resolveVideoInput(
  input: Uint8Array | string | VargElement<"video"> | undefined,
  ctx: RenderContext,
): Promise<Uint8Array | undefined> {
  if (!input) return undefined;
  if (input instanceof Uint8Array) return input;
  if (typeof input === "string") {
    const response = await fetch(toFileUrl(input));
    return new Uint8Array(await response.arrayBuffer());
  }
  if (input.type === "video") {
    const { renderVideo } = await import("./video");
    const file = await renderVideo(input, ctx);
    return file.arrayBuffer();
  }
  throw new Error(
    `Unsupported video input type: ${(input as VargElement).type}`,
  );
}

/** Resolve an audio input (Uint8Array | path/URL | speech/audio element) to bytes. */
export async function resolveAudioInput(
  input:
    | Uint8Array
    | string
    | VargElement<"speech">
    | VargElement<"audio">
    | undefined,
  ctx: RenderContext,
): Promise<Uint8Array | undefined> {
  if (!input) return undefined;
  if (input instanceof Uint8Array) return input;
  if (typeof input === "string") {
    const response = await fetch(toFileUrl(input));
    return new Uint8Array(await response.arrayBuffer());
  }
  if (
    input instanceof ResolvedElement &&
    (input.type === "speech" || input.type === "audio")
  ) {
    return input.meta.file.arrayBuffer();
  }
  if (input.type === "speech") {
    const file = await renderSpeech(input as VargElement<"speech">, ctx);
    return file.arrayBuffer();
  }
  if (input.type === "audio") {
    const { renderAudio } = await import("./audio");
    const file = await renderAudio(input as VargElement<"audio">, ctx);
    return file.arrayBuffer();
  }
  throw new Error(
    `Unsupported audio input type: ${(input as VargElement).type}`,
  );
}
