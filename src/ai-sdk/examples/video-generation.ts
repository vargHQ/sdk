import { experimental_generateImage as generateImage } from "ai";
import { fal, generateVideo } from "../index";

async function main() {
  console.log("generating video from text...");
  const { video } = await generateVideo({
    model: fal.videoModel("wan-2.5"),
    prompt: "a serene mountain lake at sunset, gentle ripples on the water",
    duration: 5,
  });

  console.log(`video generated: ${video.uint8Array.byteLength} bytes`);
  await Bun.write("output/text-to-video.mp4", video.uint8Array);

  console.log("\ngenerating image first...");
  const { images } = await generateImage({
    model: fal.imageModel("flux-schnell"),
    prompt: "a cute robot waving, 3d render, studio lighting",
    n: 1,
  });

  console.log("animating image to video...");
  const { video: animatedVideo } = await generateVideo({
    model: fal.videoModel("wan-2.5"),
    prompt: "robot waves cheerfully, smooth animation",
    files: [
      {
        type: "file",
        mediaType: "image/png",
        data: images[0]!.uint8Array,
      },
    ],
    duration: 5,
  });

  console.log(`animated video: ${animatedVideo.uint8Array.byteLength} bytes`);
  await Bun.write("output/image-to-video.mp4", animatedVideo.uint8Array);

  console.log("\ndone!");
}

main().catch(console.error);
