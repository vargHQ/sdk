/**
 * Speech segments demo — one Speech() call split into 3 scenes:
 *   Scene 1: VEED lipsync talking head  (segment 0 audio)
 *   Scene 2: image b-roll               (segment 1 duration)
 *   Scene 3: VEED lipsync talking head   (segment 2 audio)
 *
 * Tests the `children: string[]` -> `.segments` feature.
 * One ElevenLabs API call; segments are pre-sliced Uint8Array.
 *
 * Run: bun run src/react/examples/async/speech-segments.tsx
 * Output: output/speech-segments.mp4
 */

import { elevenlabs } from "../../../ai-sdk/providers/elevenlabs";
import { fal } from "../../../ai-sdk/providers/fal";
import { Clip, Image, Render, render, Speech, Video } from "../..";

// --- One speech call, three segments ---
const { audio, segments } = await Speech({
  model: elevenlabs.speechModel("eleven_v3"),
  voice: "adam",
  children: [
    "Scientists always lied to you about bananas.",
    "Bananas are normally dangerous, they can kill your gut health.",
    'The actual issue is Banana bacteria called "alupios manurale" causing food poisoning symptoms.',
  ],
});

console.log(`Total duration: ${audio.duration.toFixed(2)}s`);
console.log(`Segments: ${segments?.length}`);
for (const [i, seg] of (segments ?? []).entries()) {
  console.log(
    `  [${i}] ${seg.start.toFixed(2)}s -> ${seg.end.toFixed(2)}s (${seg.duration.toFixed(2)}s) "${seg.text}"`,
  );
}
console.log(`Words: ${audio.words?.length}`);

// --- Portrait for the talking head ---
const portrait = Image({
  prompt:
    "Ultra-realistic studio portrait of a serious male scientist in his 40s, lab coat, glasses, concerned expression, dramatic lighting, dark background, documentary style",
  model: fal.imageModel("nano-banana-pro"),
  aspectRatio: "9:16",
});

// --- Scene 1: lipsync talking head with segment 0 audio ---
const talking1 = Video({
  model: fal.videoModel("veed-fabric-1.0"),
  keepAudio: true,
  prompt: {
    images: [portrait],
    audio: segments![0]!,
  },
  providerOptions: { fal: { resolution: "720p" } },
});

// --- Scene 3: lipsync talking head with segment 2 audio ---
const talking3 = Video({
  model: fal.videoModel("veed-fabric-1.0"),
  keepAudio: true,
  prompt: {
    images: [portrait],
    audio: segments![2]!,
  },
  providerOptions: { fal: { resolution: "720p" } },
});

const demo = (
  <Render width={1080} height={1920}>
    {/* Scene 1: talking head with lipsync */}
    <Clip duration={segments![0]!.duration}>{talking1}</Clip>

    {/* Scene 2: banana b-roll */}
    <Clip duration={segments![1]!.duration}>
      <Image
        prompt="macro shot of a dangerous banana with dramatic dark lighting, bacteria visualization, medical documentary style, gut health danger concept"
        model={fal.imageModel("nano-banana-pro")}
        aspectRatio="9:16"
        zoom="in"
      />
    </Clip>

    {/* Scene 3: talking head with lipsync */}
    <Clip duration={segments![2]!.duration}>{talking3}</Clip>

    {/* Full voiceover spanning all clips */}
    {audio}
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
    output: "output/speech-segments.mp4",
    cache: ".cache/ai-speech-segments",
  });

  console.log(
    `Done: output/speech-segments.mp4 (${(result.video.byteLength / 1024 / 1024).toFixed(2)} MB)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
