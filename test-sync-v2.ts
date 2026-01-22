/**
 * Quick sync-v2 lipsync test
 * Required env: FAL_API_KEY
 */

import { File, fal, generateVideo } from "./src/ai-sdk/index";

async function main() {
  const videoPath = "output/extracted-videos/tyler/tyler-10.mp4";
  const audioPath = "output/extracted-videos/tyler/tyler-10.mp4"; // use same video's audio for now

  console.log("loading media files...");
  const videoFile = File.fromPath(videoPath);
  const audioFile = File.fromPath(audioPath);

  console.log("lipsyncing with sync-v2...");
  const { video } = await generateVideo({
    model: fal.videoModel("sync-v2"),
    prompt: {
      video: await videoFile.data(),
      audio: await audioFile.data(),
    },
  });

  console.log(`lipsynced video: ${video.uint8Array.byteLength} bytes`);
  await Bun.write("output/test-sync-v2.mp4", video.uint8Array);
  console.log("done! saved to output/test-sync-v2.mp4");
}

main().catch(console.error);
