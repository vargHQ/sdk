import { $ } from "bun";
import { File } from "../../ai-sdk/file";
import type { RawInput, RawProps, VargElement } from "../types";
import type { RenderContext } from "./context";
import { renderImage } from "./image";
import { renderVideo } from "./video";

async function resolveInput(
  input: RawInput,
  ctx: RenderContext,
): Promise<string> {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof Uint8Array) {
    const tempPath = await File.toTemp({ uint8Array: input });
    ctx.tempFiles.push(tempPath);
    return tempPath;
  }

  if (input.type === "image") {
    return renderImage(input as VargElement<"image">, ctx);
  }

  if (input.type === "video") {
    return renderVideo(input as VargElement<"video">, ctx);
  }

  if (input.type === "raw") {
    return renderRaw(input as VargElement<"raw">, ctx);
  }

  throw new Error(`Unsupported Raw input type: ${(input as VargElement).type}`);
}

export async function renderRaw(
  element: VargElement<"raw">,
  ctx: RenderContext,
): Promise<string> {
  const props = element.props as unknown as RawProps;

  const inputPaths = await Promise.all(
    props.inputs.map((input) => resolveInput(input, ctx)),
  );

  const outPath = props.output ?? `/tmp/varg-raw-${Date.now()}.mp4`;

  const inputArgs = inputPaths.flatMap((path) => ["-i", path]);
  const ffmpegArgs = [...inputArgs, ...props.args, "-y", outPath];

  const result =
    await $`ffmpeg -hide_banner -loglevel error ${ffmpegArgs}`.quiet();

  if (result.exitCode !== 0) {
    throw new Error(`ffmpeg failed with exit code ${result.exitCode}`);
  }

  ctx.tempFiles.push(outPath);
  return outPath;
}
