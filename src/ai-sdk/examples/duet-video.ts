import { fal as falClient } from "@fal-ai/client";
import { generateImage } from "ai";
import { fal, generateVideo } from "../index";

const PROMPTS = [
  "Two women singing a passionate duet on a grand concert stage, dramatic stage lighting with purple and blue spotlights, professional microphones, emotional performance, wide cinematic shot",
  "Close-up shot of two female singers performing together on stage, concert lighting, passionate singing moment, professional stage setup, intimate duet",
  "Two elegant women performers on stage singing into microphones, concert hall with dramatic lighting, audience silhouettes in background, emotional duet performance",
];

async function uploadFile(data: Uint8Array): Promise<string> {
  return falClient.storage.upload(new Blob([data]));
}

async function main() {
  console.log("=== taisa & irina duet generator ===\n");

  const taisa1 = new Uint8Array(
    await Bun.file("media/taisa/taisa.jpg").arrayBuffer(),
  );
  const taisa2 = new Uint8Array(
    await Bun.file("media/taisa/taisa2.jpg").arrayBuffer(),
  );
  const irina1 = new Uint8Array(
    await Bun.file("media/taisa/irina.jpg").arrayBuffer(),
  );
  const irinaScene = new Uint8Array(
    await Bun.file("media/taisa/irina-scene.png").arrayBuffer(),
  );

  console.log("loaded reference images:");
  console.log(`  taisa1: ${taisa1.byteLength} bytes`);
  console.log(`  taisa2: ${taisa2.byteLength} bytes`);
  console.log(`  irina1: ${irina1.byteLength} bytes`);
  console.log(`  irina-scene: ${irinaScene.byteLength} bytes\n`);

  console.log("uploading reference images...");
  const [taisa1Url, irina1Url, irinaSceneUrl] = await Promise.all([
    uploadFile(taisa1),
    uploadFile(irina1),
    uploadFile(irinaScene),
  ]);
  console.log("uploaded.\n");

  for (let i = 0; i < 3; i++) {
    console.log(`\n--- scene ${i + 1}/3 ---`);

    console.log(`[${i + 1}] generating frame with nano-banana-pro/edit...`);
    const { images } = await generateImage({
      model: fal.imageModel("nano-banana-pro"),
      prompt: PROMPTS[i]!,
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
    await Bun.write(`output/duet-frame-${i + 1}.png`, frameData);
    console.log(
      `[${i + 1}] frame: output/duet-frame-${i + 1}.png (${frameData.byteLength} bytes)`,
    );

    console.log(`[${i + 1}] animating 5s with wan-2.5...`);
    const { video: video1 } = await generateVideo({
      model: fal.videoModel("wan-2.5"),
      prompt:
        "two women singing passionately on stage, subtle natural movements, breathing, blinking, emotional expressions, concert atmosphere",
      files: [{ type: "file", mediaType: "image/png", data: frameData }],
      duration: 5,
    });

    console.log(`[${i + 1}] animating another 5s...`);
    const { video: video2 } = await generateVideo({
      model: fal.videoModel("wan-2.5"),
      prompt:
        "two women singing passionately on stage, subtle natural movements, breathing, blinking, emotional expressions, concert atmosphere",
      files: [{ type: "file", mediaType: "image/png", data: frameData }],
      duration: 5,
    });

    await Bun.write(`output/duet-scene-${i + 1}-a.mp4`, video1.uint8Array);
    await Bun.write(`output/duet-scene-${i + 1}-b.mp4`, video2.uint8Array);
    console.log(
      `[${i + 1}] videos: duet-scene-${i + 1}-a.mp4 (${video1.uint8Array.byteLength}), duet-scene-${i + 1}-b.mp4 (${video2.uint8Array.byteLength})`,
    );
  }

  console.log("\n=== done! ===");
  console.log("frames: output/duet-frame-{1,2,3}.png");
  console.log("videos: output/duet-scene-{1,2,3}-{a,b}.mp4");
}

main().catch(console.error);
