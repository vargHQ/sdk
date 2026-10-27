/**
 * Auto-resolve string model IDs into real model objects.
 *
 * Element props accept either a model object (`fal.videoModel("kling-v3")`) or
 * a bare string ID (`"seedance_2_5"`). The generation functions
 * (`generateVideo`, `generateMusic`, …) call `model.doGenerate`, which only
 * exists on model objects — a plain string crashes with
 * `TypeError: model.doGenerate is not a function`.
 *
 * String IDs are resolved through the unified `varg` provider, which routes to
 * the correct upstream provider via `api.varg.ai`. This keeps the JSX surface
 * ergonomic (`<Music model="music_v1" />`, `<Video model="seedance_2_5" />`)
 * without forcing every template to import a provider factory.
 *
 * Model objects pass through untouched.
 */
import type { ImageModelV3, SpeechModelV3 } from "@ai-sdk/provider";
import { varg } from "../ai-sdk/providers/varg";
import type { MusicModelV3 } from "../ai-sdk/music-model";
import type { VideoModelV3 } from "../ai-sdk/video-model";

export function resolveImageModel(
  model: ImageModelV3 | string,
): ImageModelV3 {
  return typeof model === "string" ? varg.imageModel(model) : model;
}

export function resolveVideoModel(
  model: VideoModelV3 | string,
): VideoModelV3 {
  return typeof model === "string" ? varg.videoModel(model) : model;
}

export function resolveSpeechModel(
  model: SpeechModelV3 | string,
): SpeechModelV3 {
  return typeof model === "string" ? varg.speechModel(model) : model;
}

export function resolveMusicModel(
  model: MusicModelV3 | string,
): MusicModelV3 {
  return typeof model === "string" ? varg.musicModel(model) : model;
}
