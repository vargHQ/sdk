import type { File } from "../../ai-sdk/file";
import { ResolvedElement } from "../resolved-element";
import type { TalkingHeadProps, VargElement } from "../types";
import type { RenderContext } from "./context";
import { renderImage } from "./image";
import { renderSpeech } from "./speech";
import { renderVideo } from "./video";

/**
 * Render a TalkingHead element into a video file.
 *
 * Pipeline:
 * 1. Resolve the character image from `image` prop (VargElement or ResolvedElement)
 * 2. Resolve the speech audio from `audio` prop (VargElement or ResolvedElement)
 * 3. Generate a lipsync video via `model` (image + audio → video)
 *
 * The result is a video File suitable for use as a VideoLayer.
 */
export async function renderTalkingHead(
  element: VargElement<"talking-head">,
  ctx: RenderContext,
): Promise<File> {
  // If already resolved via `await TalkingHead(...)`, reuse the pre-generated file
  if (element instanceof ResolvedElement) {
    ctx.generatedFiles.push(element.meta.file);
    return element.meta.file;
  }

  const props = element.props as TalkingHeadProps;

  const model = props.model ?? ctx.defaults?.video;
  if (!model) {
    throw new Error(
      "TalkingHead requires 'model' prop (or set defaults.video in render options)",
    );
  }

  if (!props.image) {
    throw new Error("TalkingHead requires 'image' prop (an Image element)");
  }

  if (!props.audio) {
    throw new Error("TalkingHead requires 'audio' prop (a Speech element)");
  }

  // Step 1 & 2: Resolve character image and speech audio in parallel
  const [characterFile, speechFile] = await Promise.all([
    resolveImageProp(props.image, ctx),
    resolveAudioProp(props.audio, ctx),
  ]);

  // Step 3: Generate lipsync video (image + audio → video)
  const lipsyncModel = props.lipsyncModel ?? model;
  const characterImageData = await characterFile.arrayBuffer();
  const speechAudioData = await speechFile.arrayBuffer();

  // Create a synthetic video element for the lipsync generation.
  // Lipsync models (sync-v2-pro, etc.) require `video_url`, not `image_url`,
  // so we pass the character image as the `video` input. The fal provider will
  // upload it and set `video_url` in the API request. Fal.ai accepts image
  // files as the video input for lipsync — it treats them as single-frame video.
  const videoElement: VargElement<"video"> = {
    type: "video",
    props: {
      prompt: {
        video: characterImageData,
        audio: speechAudioData,
      },
      model: lipsyncModel,
      keepAudio: true,
      providerOptions: { fal: { resolution: props.resolution ?? "720p" } },
    },
    children: [],
  };

  return renderVideo(videoElement, ctx);
}

/**
 * Resolve an image prop — either a pre-resolved ResolvedElement<"image">
 * or a lazy VargElement<"image"> that needs rendering.
 */
async function resolveImageProp(
  image: VargElement<"image">,
  ctx: RenderContext,
): Promise<File> {
  if (image instanceof ResolvedElement) {
    ctx.generatedFiles.push(image.meta.file);
    return image.meta.file;
  }

  return renderImage(image, ctx);
}

/**
 * Resolve an audio prop — either a pre-resolved ResolvedElement<"speech">
 * or a lazy VargElement<"speech"> that needs rendering.
 */
async function resolveAudioProp(
  audio: VargElement<"speech">,
  ctx: RenderContext,
): Promise<File> {
  if (audio instanceof ResolvedElement) {
    ctx.generatedFiles.push(audio.meta.file);
    return audio.meta.file;
  }

  return renderSpeech(audio, ctx);
}
