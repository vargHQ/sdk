import { generateImage as _generateImage } from "ai";
import { generateVideo as _generateVideo, fal, withCache } from "../index";

// wrap with defaults (memory cache, 1h ttl)
const generateImage = withCache(_generateImage);
const generateVideo = withCache(_generateVideo);

async function main() {
  const take = 1;

  // cached video generation
  console.log("generating video...");
  console.time("first");
  const { video } = await generateVideo({
    model: fal.videoModel("wan-2.5"),
    prompt: "a cat playing piano",
    duration: 5,
    cacheKey: ["cat-piano", take],
  });
  console.timeEnd("first");
  console.log(`video: ${video.uint8Array.byteLength} bytes`);

  // same cacheKey = instant cache hit
  console.log("\nsame cacheKey (from cache)...");
  console.time("cached");
  const { video: video2 } = await generateVideo({
    model: fal.videoModel("wan-2.5"),
    prompt: "a cat playing piano",
    duration: 5,
    cacheKey: ["cat-piano", take],
  });
  console.timeEnd("cached");
  console.log(`video: ${video2.uint8Array.byteLength} bytes`);

  // cached image generation
  console.log("\ngenerating image...");
  const { images } = await generateImage({
    model: fal.imageModel("flux-schnell"),
    prompt: "cyberpunk cityscape",
    n: 1,
    cacheKey: ["cyberpunk-city", 1],
  });
  console.log(`image: ${images[0]?.uint8Array.byteLength} bytes`);

  // no cacheKey = no caching
  console.log("\nno cacheKey (always hits API)...");
  const { video: video3 } = await generateVideo({
    model: fal.videoModel("wan-2.5"),
    prompt: "waves on beach",
    duration: 5,
  });
  console.log(`video: ${video3.uint8Array.byteLength} bytes`);

  console.log("\ndone!");
}

main().catch(console.error);
