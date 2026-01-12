import { fal as falClient } from "@fal-ai/client";

async function uploadFile(path: string): Promise<string> {
  const data = await Bun.file(path).arrayBuffer();
  return falClient.storage.upload(new Blob([new Uint8Array(data)]));
}

async function main() {
  console.log("=== taisa closeup with audio - scene 5 ===\n");

  console.log("uploading image and audio...");
  const [imageUrl, audioUrl] = await Promise.all([
    uploadFile("output/duet-frame-4.png"),
    uploadFile("output/audio-1m09s-5s.mp3"),
  ]);
  console.log("uploaded.\n");

  console.log("generating 5s video with wan-2.5-preview (audio-driven)...");
  const result = await falClient.subscribe(
    "fal-ai/wan-25-preview/image-to-video",
    {
      input: {
        image_url: imageUrl,
        audio_url: audioUrl,
        prompt:
          "closeup of woman singing passionately, lips synced to audio, subtle head movements, natural breathing, blinking, emotional expressions, concert atmosphere with stage lighting",
      },
      logs: true,
    },
  );

  const data = result.data as { video?: { url?: string } };
  const videoUrl = data?.video?.url;

  if (!videoUrl) {
    console.error("no video url in response:", result.data);
    return;
  }

  const videoResponse = await fetch(videoUrl);
  const videoBuffer = await videoResponse.arrayBuffer();
  await Bun.write("output/duet-scene-5-audio.mp4", new Uint8Array(videoBuffer));
  console.log(
    `video saved: output/duet-scene-5-audio.mp4 (${videoBuffer.byteLength} bytes)`,
  );

  console.log("\ndone!");
}

main().catch(console.error);
