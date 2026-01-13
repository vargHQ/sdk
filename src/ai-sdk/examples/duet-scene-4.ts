import { generateImage } from "ai";
import { File, fal, generateVideo } from "../index";

async function main() {
  console.log("=== taisa solo closeup - scene 4 ===\n");

  const referenceImages = [
    File.fromPath("media/taisa/taisa.jpg"),
    File.fromPath("output/original-frame-1m08s.png"),
  ];

  const imageContents = await Promise.all(
    referenceImages.map((f) => f.arrayBuffer()),
  );

  console.log("generating closeup frame with nano-banana-pro/edit...");
  const { image } = await generateImage({
    model: fal.imageModel("nano-banana-pro/edit"),
    prompt: {
      images: imageContents,
      text: "Closeup portrait of dark-haired brunette woman Taisa singing passionately on concert stage, dramatic purple blue stage lighting, emotional expression, glamorous dress, beautiful face, professional concert hall background blurred",
    },
    aspectRatio: "16:9",
    n: 1,
    providerOptions: {
      fal: { resolution: "1K" },
    },
  });

  await Bun.write("output/duet-frame-4.png", image.uint8Array);
  console.log(
    `frame saved: output/duet-frame-4.png (${image.uint8Array.byteLength} bytes)\n`,
  );

  console.log("animating 10s with kling-v2.5...");
  const { video } = await generateVideo({
    model: fal.videoModel("kling-v2.5"),
    prompt: {
      images: image.uint8Array,
      text: "closeup of woman singing passionately, subtle head movements, lips moving as singing, natural breathing, blinking, emotional expressions, concert atmosphere with stage lighting",
    },
    duration: 10,
  });

  await Bun.write("output/duet-scene-4.mp4", video.uint8Array);
  console.log(
    `video saved: output/duet-scene-4.mp4 (${video.uint8Array.byteLength} bytes)`,
  );

  console.log("\ndone!");
}

main().catch(console.error);
