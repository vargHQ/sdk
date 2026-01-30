import { generateImage as _generateImage } from "ai";
import {
  generateVideo as _generateVideo,
  editly,
  fal,
  fileCache,
  withCache,
} from "../index";

const storage = fileCache({ dir: ".cache/ai" });
const generateImage = withCache(_generateImage, { storage });
const generateVideo = withCache(_generateVideo, { storage });

async function main() {
  const personBase =
    "30 year old man, brown hair, casual clothes, gym background";

  console.log("step 1: generating before image (overweight)...");
  const { images: beforeImages } = await generateImage({
    model: fal.imageModel("flux-schnell"),
    prompt: `${personBase}, overweight, tired expression, slouching posture, before fitness transformation`,
    aspectRatio: "3:4",
    n: 1,
    cacheKey: ["before-after", "before-image"],
  });

  const firstBeforeImage = beforeImages[0];
  if (!firstBeforeImage) throw new Error("No before image generated");
  const beforeImage = firstBeforeImage.uint8Array;
  await Bun.write("output/workflow-before-image.png", beforeImage);
  console.log("saved: output/workflow-before-image.png");

  console.log("\nstep 2: generating after image (fit)...");
  const { images: afterImages } = await generateImage({
    model: fal.imageModel("flux-schnell"),
    prompt: `${personBase}, fit and muscular, confident smile, good posture, after fitness transformation, healthy glow`,
    aspectRatio: "3:4",
    n: 1,
    cacheKey: ["before-after", "after-image"],
  });

  const firstAfterImage = afterImages[0];
  if (!firstAfterImage) throw new Error("No after image generated");
  const afterImage = firstAfterImage.uint8Array;
  await Bun.write("output/workflow-after-image.png", afterImage);
  console.log("saved: output/workflow-after-image.png");

  console.log("\nstep 3: animating before video...");
  const { video: beforeVideo } = await generateVideo({
    model: fal.videoModel("wan-2.5"),
    prompt: {
      text: "man standing, slight breathing movement, looking at camera, subtle movements",
      images: [beforeImage],
    },
    duration: 5,
    cacheKey: ["before-after", "before-video"],
  });

  await Bun.write("output/workflow-before-video.mp4", beforeVideo.uint8Array);
  console.log("saved: output/workflow-before-video.mp4");

  console.log("\nstep 4: animating after video...");
  const { video: afterVideo } = await generateVideo({
    model: fal.videoModel("wan-2.5"),
    prompt: {
      text: "fit man standing confidently, slight breathing movement, looking at camera, flexing slightly",
      images: [afterImage],
    },
    duration: 5,
    cacheKey: ["before-after", "after-video"],
  });

  await Bun.write("output/workflow-after-video.mp4", afterVideo.uint8Array);
  console.log("saved: output/workflow-after-video.mp4");

  console.log("\nstep 5: creating split-screen comparison...");
  await editly({
    outPath: "output/workflow-before-after.mp4",
    width: 1280,
    height: 720,
    fps: 30,
    verbose: true,
    clips: [
      {
        duration: 5,
        layers: [
          { type: "fill-color", color: "#000000" },
          {
            type: "video",
            path: "output/workflow-before-video.mp4",
            width: 0.48,
            height: 0.9,
            left: 0.01,
            top: 0.05,
          },
          {
            type: "video",
            path: "output/workflow-after-video.mp4",
            width: 0.48,
            height: 0.9,
            left: 0.51,
            top: 0.05,
          },
          {
            type: "title",
            text: "BEFORE                    AFTER",
            textColor: "#ffffff",
            position: "bottom",
          },
        ],
      },
    ],
  });

  console.log("\ndone! output/workflow-before-after.mp4");
}

main().catch(console.error);
