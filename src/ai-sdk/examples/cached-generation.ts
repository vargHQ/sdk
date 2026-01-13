import { generateImage } from "ai";
import {
  fal,
  fileCache,
  type GenerateVideoOptions,
  generateVideo,
  hashPrompt,
  withCache,
} from "../index";

// file-based cache (persists to disk)
const storage = fileCache({ dir: ".cache/ai" });

const cachedGenerateVideo = withCache(generateVideo, {
  key: (opts: GenerateVideoOptions) => `video:${hashPrompt(opts.prompt)}`,
  ttl: "24h",
  storage,
});

async function main() {
  const prompt = "a cat playing piano, jazz club atmosphere";

  // first call - hits API
  console.log("generating video (first call - no cache)...");
  console.time("first");
  const { video: video1 } = await cachedGenerateVideo({
    model: fal.videoModel("wan-2.5"),
    prompt,
    duration: 5,
  });
  console.timeEnd("first");
  console.log(`video: ${video1.uint8Array.byteLength} bytes`);

  // second call - hits cache
  console.log("\ngenerating video (second call - from cache)...");
  console.time("cached");
  const { video: video2 } = await cachedGenerateVideo({
    model: fal.videoModel("wan-2.5"),
    prompt,
    duration: 5,
  });
  console.timeEnd("cached");
  console.log(`video: ${video2.uint8Array.byteLength} bytes`);

  // cache key changes with prompt
  console.log("\ndifferent prompt (no cache)...");
  console.time("different");
  const { video: video3 } = await cachedGenerateVideo({
    model: fal.videoModel("wan-2.5"),
    prompt: "a dog surfing, sunset beach",
    duration: 5,
  });
  console.timeEnd("different");
  console.log(`video: ${video3.uint8Array.byteLength} bytes`);

  // works with generateImage too
  const cachedGenerateImage = withCache(generateImage, {
    key: (opts: Parameters<typeof generateImage>[0]) =>
      `image:${hashPrompt(opts.prompt)}:${opts.n ?? 1}`,
    ttl: "24h",
    storage,
  });

  console.log("\ngenerating image (cached)...");
  const { images } = await cachedGenerateImage({
    model: fal.imageModel("flux-schnell"),
    prompt: "cyberpunk cityscape at night",
    n: 1,
  });
  console.log(`image: ${images[0]?.uint8Array.byteLength} bytes`);

  console.log("\ndone!");
}

main().catch(console.error);
