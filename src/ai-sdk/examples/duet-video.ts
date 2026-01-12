import { fal as falClient } from "@fal-ai/client";
import { generateImage } from "ai";
import { fal, generateVideo } from "../index";

async function uploadFile(data: Uint8Array): Promise<string> {
  return falClient.storage.upload(new Blob([data]));
}

async function main() {
  console.log("=== taisa & irina duet - scene 3 ===\n");

  const taisa1 = new Uint8Array(
    await Bun.file("media/taisa/taisa.jpg").arrayBuffer(),
  );
  const irina1 = new Uint8Array(
    await Bun.file("media/taisa/irina.jpg").arrayBuffer(),
  );
  const irinaScene = new Uint8Array(
    await Bun.file("media/taisa/irina-scene.png").arrayBuffer(),
  );

  console.log("uploading reference images...");
  const [taisa1Url, irina1Url, irinaSceneUrl] = await Promise.all([
    uploadFile(taisa1),
    uploadFile(irina1),
    uploadFile(irinaScene),
  ]);
  console.log("uploaded.\n");

  console.log("generating first frame with nano-banana-pro/edit...");
  const { images } = await generateImage({
    model: fal.imageModel("nano-banana-pro"),
    prompt:
      "Two elegant women performers on stage singing into microphones facing camera, concert hall with dramatic purple and blue lighting, audience silhouettes in background, emotional duet performance, both faces visible looking at viewer, glamorous dresses",
    aspectRatio: "16:9",
    n: 1,
    providerOptions: {
      fal: {
        image_urls: [taisa1Url, irina1Url, irinaSceneUrl],
        resolution: "1K",
      },
    },
  });

  const frameData = images[0]!.uint8Array;
  await Bun.write("output/duet-frame-3.png", frameData);
  console.log(
    `frame saved: output/duet-frame-3.png (${frameData.byteLength} bytes)\n`,
  );

  console.log("animating 10s with kling-v2.5...");
  const { video } = await generateVideo({
    model: fal.videoModel("kling-v2.5"),
    prompt:
      "two women singing together on stage, subtle head movements, lips moving as singing, natural breathing, blinking, emotional expressions, concert atmosphere with stage lighting",
    files: [{ type: "file", mediaType: "image/png", data: frameData }],
    duration: 10,
  });

  await Bun.write("output/duet-scene-3.mp4", video.uint8Array);
  console.log(
    `video saved: output/duet-scene-3.mp4 (${video.uint8Array.byteLength} bytes)`,
  );

  console.log("\ndone!");
}

main().catch(console.error);
