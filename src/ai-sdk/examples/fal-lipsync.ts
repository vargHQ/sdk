/**
 * Fal Lipsync
 * Required env: FAL_API_KEY
 */

import { File, fal, generateVideo } from "../index";

async function main() {
  const videoPath = "media/talking-aleks-animated.mp4";
  const audioPath = "media/talking-aleks-voice.mp3";

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
  await Bun.write("output/lipsynced-v2.mp4", video.uint8Array);

  console.log("\nlipsyncing with sync-v2-pro...");
  const { video: proVideo } = await generateVideo({
    model: fal.videoModel("sync-v2-pro"),
    prompt: {
      video: await videoFile.data(),
      audio: await audioFile.data(),
    },
  });

  console.log(`pro lipsynced video: ${proVideo.uint8Array.byteLength} bytes`);
  await Bun.write("output/lipsynced-pro.mp4", proVideo.uint8Array);

  console.log("\ndone!");
}

main().catch(console.error);
