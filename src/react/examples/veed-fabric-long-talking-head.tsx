/**
 * Longer talking head demo (VEED Fabric 1.0):
 * - character image from nano-banana-pro
 * - voice from ElevenLabs
 * - talking video from veed/fabric-1.0 (image + audio)
 *
 * Run: bun run src/react/examples/veed-fabric-long-talking-head.tsx
 * Output: output/veed-fabric-long-talking-head.mp4
 */

import { elevenlabs, fal } from "../../ai-sdk";
import { Clip, Image, Render, render, Speech, Video } from "..";

const SCRIPT =
  "Hey, I am Nova. In this quick demo, you will hear a clean voiceover, and see a talking avatar generated from a single portrait. We are using VEED Fabric for image-to-video lipsync, and ElevenLabs for the voice.";

const portrait = Image({
  prompt:
    "Ultra-realistic studio portrait of Nova, a confident friendly product designer in her early 30s, warm smile, expressive eyes, subtle freckles, natural makeup, shoulder-length dark auburn hair, modern minimal wardrobe, cinematic softbox lighting, shallow depth of field, clean neutral background, high-end camera look",
  model: fal.imageModel("nano-banana-pro"),
  aspectRatio: "9:16",
});

const voiceover = Speech({
  model: elevenlabs.speechModel("eleven_v3"),
  voice: "adam",
  children: SCRIPT,
});

const talking = Video({
  model: fal.videoModel("veed-fabric-1.0"),
  keepAudio: true,
  prompt: {
    images: [portrait],
    audio: voiceover,
  },
  providerOptions: {
    fal: {
      resolution: "720p",
    },
  },
});

const demo = (
  <Render width={1080} height={1920}>
    <Clip duration="auto">{talking}</Clip>
  </Render>
);

async function main() {
  if (!process.env.FAL_API_KEY && !process.env.FAL_KEY) {
    console.error("ERROR: FAL_API_KEY/FAL_KEY not found in environment");
    process.exit(1);
  }
  if (!process.env.ELEVENLABS_API_KEY) {
    console.error("ERROR: ELEVENLABS_API_KEY not found in environment");
    process.exit(1);
  }

  const result = await render(demo, {
    output: "output/veed-fabric-long-talking-head.mp4",
    cache: ".cache/ai-veed-fabric-long-talking-head",
  });

  console.log(
    `ok: output/veed-fabric-long-talking-head.mp4 (${(result.video.byteLength / 1024 / 1024).toFixed(2)} MB)`,
  );
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
