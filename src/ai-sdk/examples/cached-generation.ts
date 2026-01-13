import { generateImage } from "ai";
import { fal, fileCache, generateVideo, withCache } from "../index";

// wrap with file-based cache
const storage = fileCache({ dir: ".cache/ai" });

const generateImage_ = withCache(generateImage, { ttl: "24h", storage });
const generateVideo_ = withCache(generateVideo, { ttl: "24h", storage });

async function main() {
  const take = 1;

  // first call - hits API
  console.log("generating video (first call - no cache)...");
  console.time("first");
  const { video: video1 } = await generateVideo_({
    model: fal.videoModel("wan-2.5"),
    prompt: "a cat playing piano, jazz club atmosphere",
    duration: 5,
    cacheKey: ["cat-piano", take],
  });
  console.timeEnd("first");
  console.log(`video: ${video1.uint8Array.byteLength} bytes`);

  // second call - hits cache (same cacheKey)
  console.log("\ngenerating video (second call - from cache)...");
  console.time("cached");
  const { video: video2 } = await generateVideo_({
    model: fal.videoModel("wan-2.5"),
    prompt: "a cat playing piano, jazz club atmosphere",
    duration: 5,
    cacheKey: ["cat-piano", take],
  });
  console.timeEnd("cached");
  console.log(`video: ${video2.uint8Array.byteLength} bytes`);

  // different cacheKey = no cache hit
  console.log("\ndifferent cacheKey (no cache)...");
  console.time("different");
  const { video: video3 } = await generateVideo_({
    model: fal.videoModel("wan-2.5"),
    prompt: "a dog surfing, sunset beach",
    duration: 5,
    cacheKey: ["dog-surfing", take],
  });
  console.timeEnd("different");
  console.log(`video: ${video3.uint8Array.byteLength} bytes`);

  // works with generateImage too
  console.log("\ngenerating image (cached)...");
  const { images } = await generateImage_({
    model: fal.imageModel("flux-schnell"),
    prompt: "cyberpunk cityscape at night",
    n: 1,
    cacheKey: ["cyberpunk-city", 1],
  });
  console.log(`image: ${images[0]?.uint8Array.byteLength} bytes`);

  // no cacheKey = no caching (pass-through)
  console.log("\nno cacheKey (always hits API)...");
  const { video: video4 } = await generateVideo_({
    model: fal.videoModel("wan-2.5"),
    prompt: "waves on beach",
    duration: 5,
    // no cacheKey - not cached
  });
  console.log(`video: ${video4.uint8Array.byteLength} bytes`);

  console.log("\ndone!");
}

main().catch(console.error);
