/**
 * Editly Video Composition
 * Requires: ffmpeg installed system-wide
 */

import { generateImage } from "ai";
import { editly, File, fal, generateVideo } from "../index";

async function main() {
  console.log("generating product image...");
  const { image } = await generateImage({
    model: fal.imageModel("flux-schnell"),
    prompt: "product shot of headphones on white background",
  });

  console.log("animating image to video...");
  const { video } = await generateVideo({
    model: fal.videoModel("kling-v2.5"),
    prompt: {
      images: [image.uint8Array],
      text: "headphones slowly rotating, product showcase",
    },
    duration: 5,
  });

  const videoPath = await File.toTemp(video);
  const imagePath = await File.toTemp(image);

  console.log("composing final video with editly...");
  await editly({
    outPath: "output/editly-composed.mp4",
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

  console.log("done! output saved to output/editly-composed.mp4");
}

main().catch(console.error);
