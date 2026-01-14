/**
 * Example: Using editly for video composition with varg sdk
 *
 * editly is a declarative video editing library. We use File.toTemp()
 * to bridge AI-generated content to editly's file-based API.
 *
 * Install editly: bun add editly
 */

import { generateImage } from "ai";
import * as editly from "editly";
import { File, fal, generateVideo } from "../index";

async function main() {
  // 1. generate assets with ai
  const { image } = await generateImage({
    model: fal.imageModel("flux-schnell"),
    prompt: "product shot of headphones on white background",
  });

  const { video } = await generateVideo({
    model: fal.videoModel("kling-v2.5"),
    prompt: {
      images: [image.uint8Array],
      text: "headphones slowly rotating, product showcase",
    },
    duration: 5,
  });

  // 2. save to temp files for editly
  const videoPath = await File.toTemp(video);
  const imagePath = await File.toTemp(image);

  // 3. compose with editly
  await editly({
    outPath: "./output/composed.mp4",
    width: 1080,
    height: 1920,
    fps: 30,
    clips: [
      {
        duration: 5,
        layers: [
          {
            type: "video",
            path: videoPath,
            resizeMode: "contain-blur",
          },
        ],
      },
      {
        duration: 3,
        transition: { name: "fade", duration: 0.5 },
        layers: [
          {
            type: "image",
            path: imagePath,
            zoomDirection: "in",
          },
        ],
      },
    ],
  });

  console.log("composed video saved to output/composed.mp4");
}

main().catch(console.error);
