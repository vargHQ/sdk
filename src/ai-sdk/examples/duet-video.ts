import { generateImage } from "ai";
import { File, fal, generateVideo, toInput } from "../index";

async function main() {
  console.log("=== taisa & irina duet - scene 3 ===\n");

  console.log("loading reference images...");
  const referenceImages = [
    File.fromPath("media/taisa/taisa.jpg"),
    File.fromPath("media/taisa/irina.jpg"),
    File.fromPath("media/taisa/irina-scene.png"),
  ];

  const imageContents = await Promise.all(
    referenceImages.map((f) => f.arrayBuffer()),
  );
  console.log("loaded.\n");

  console.log("generating first frame with nano-banana-pro/edit...");
  const { image } = await generateImage({
    model: fal.imageModel("nano-banana-pro"),
    prompt: {
      images: imageContents,
      text: "Wide shot of two different women singing duet on grand concert stage, dark-haired brunette Taisa on left and blonde Irina on right, both facing camera, dramatic purple blue stage lighting, audience visible, glamorous dresses, professional concert hall",
    },
    aspectRatio: "16:9",
    n: 1,
    providerOptions: {
      fal: {
        resolution: "1K",
      },
    },
  });

  await Bun.write("output/duet-frame-3.png", image.uint8Array);
  console.log(
    `frame saved: output/duet-frame-3.png (${image.uint8Array.byteLength} bytes)\n`,
  );

  console.log("animating 10s with kling-v2.5...");
  const { video } = await generateVideo({
    model: fal.videoModel("kling-v2.5"),
    prompt:
      "two women singing together on stage, subtle head movements, lips moving as singing, natural breathing, blinking, emotional expressions, concert atmosphere with stage lighting",
    files: [toInput(image)],
    duration: 10,
  });

  await Bun.write("output/duet-scene-3.mp4", video.uint8Array);
  console.log(
    `video saved: output/duet-scene-3.mp4 (${video.uint8Array.byteLength} bytes)`,
  );

  console.log("\ndone!");
}

main().catch(console.error);
