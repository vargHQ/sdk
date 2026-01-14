/**
 * OpenAI Sora Video Generation
 * Required env: OPENAI_API_KEY
 */

import { generateVideo, openai } from "../index";

async function main() {
  console.log("generating 16:9 video with sora...");
  const { video } = await generateVideo({
    model: openai.videoModel("sora-2"),
    prompt: "a cat walking on a sunny beach, waves gently lapping at the shore",
    duration: 4,
    aspectRatio: "16:9",
  });

  console.log(`video generated: ${video.uint8Array.byteLength} bytes`);
  await Bun.write("output/sora-landscape.mp4", video.uint8Array);

  console.log("\ngenerating 9:16 vertical video...");
  const { video: verticalVideo } = await generateVideo({
    model: openai.videoModel("sora-2"),
    prompt: "a rocket launching into space, dramatic smoke and flames",
    duration: 4,
    aspectRatio: "9:16",
  });

  console.log(`vertical video: ${verticalVideo.uint8Array.byteLength} bytes`);
  await Bun.write("output/sora-vertical.mp4", verticalVideo.uint8Array);

  console.log("\ndone!");
}

main().catch(console.error);
