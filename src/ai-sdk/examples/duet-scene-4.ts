import { fal as falClient } from "@fal-ai/client";
import { generateImage } from "ai";
import { fal, generateVideo } from "../index";

async function uploadFile(data: Uint8Array): Promise<string> {
  return falClient.storage.upload(new Blob([data]));
}

async function main() {
  console.log("=== taisa solo closeup - scene 4 ===\n");

  const taisa1 = new Uint8Array(
    await Bun.file("media/taisa/taisa.jpg").arrayBuffer(),
  );
  const originalFrame = new Uint8Array(
    await Bun.file("output/original-frame-1m08s.png").arrayBuffer(),
  );

  console.log("uploading reference images...");
  const [taisa1Url, originalFrameUrl] = await Promise.all([
    uploadFile(taisa1),
    uploadFile(originalFrame),
  ]);
  console.log("uploaded.\n");

  console.log("generating closeup frame with nano-banana-pro/edit...");
  const { images } = await generateImage({
    model: fal.imageModel("nano-banana-pro"),
    prompt:
      "Closeup portrait of dark-haired brunette woman Taisa singing passionately on concert stage, dramatic purple blue stage lighting, emotional expression, glamorous dress, beautiful face, professional concert hall background blurred",
    aspectRatio: "16:9",
    n: 1,
    providerOptions: {
      fal: {
        image_urls: [taisa1Url, originalFrameUrl],
        resolution: "1K",
      },
    },
  });

  const frameData = images[0]!.uint8Array;
  await Bun.write("output/duet-frame-4.png", frameData);
  console.log(
    `frame saved: output/duet-frame-4.png (${frameData.byteLength} bytes)\n`,
  );

  console.log("animating 10s with kling-v2.5...");
  const { video } = await generateVideo({
    model: fal.videoModel("kling-v2.5"),
    prompt:
      "closeup of woman singing passionately, subtle head movements, lips moving as singing, natural breathing, blinking, emotional expressions, concert atmosphere with stage lighting",
    files: [{ type: "file", mediaType: "image/png", data: frameData }],
    duration: 10,
  });

  await Bun.write("output/duet-scene-4.mp4", video.uint8Array);
  console.log(
    `video saved: output/duet-scene-4.mp4 (${video.uint8Array.byteLength} bytes)`,
  );

  console.log("\ndone!");
}

main().catch(console.error);
