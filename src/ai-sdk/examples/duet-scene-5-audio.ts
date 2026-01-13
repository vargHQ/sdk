import { createFile, fal, generateVideo } from "../index";

async function main() {
  console.log("=== taisa closeup with audio - scene 5 ===\n");

  console.log("generating 5s video with wan-2.5-preview (audio-driven)...");
  const { video } = await generateVideo({
    model: fal.videoModel("wan-2.5-preview"),
    prompt:
      "static camera, fixed closeup shot of woman singing passionately, no camera movement, no zoom, lips synced to audio, subtle head movements, natural breathing, blinking, emotional expressions, concert atmosphere with stage lighting",
    files: [
      await createFile("output/duet-frame-4.png"),
      await createFile("output/audio-1m09s-5s.mp3"),
    ],
    duration: 5,
  });

  await Bun.write("output/duet-scene-5-audio.mp4", video.uint8Array);
  console.log(
    `video saved: output/duet-scene-5-audio.mp4 (${video.uint8Array.byteLength} bytes)`,
  );

  console.log("\ndone!");
}

main().catch(console.error);
