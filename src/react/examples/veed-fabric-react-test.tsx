/**
 * VEED Fabric 1.0 React syntax test
 *
 * Uses a local image + local audio file to generate a talking video.
 *
 * Run: bun run src/react/examples/veed-fabric-react-test.tsx
 * Output: output/veed-fabric-react-test.mp4
 */

import { fal } from "../../ai-sdk/providers/fal";
import { Clip, Render, render, Video } from "..";

const IMAGE_PATH = "output/garry-tan-image.png";
const AUDIO_PATH = "output/garry-tan-voice.mp3";

const RESOLUTION =
  (process.env.FABRIC_RESOLUTION as "480p" | "720p" | undefined) ?? "720p";

const video = (
  <Render width={720} height={1280}>
    <Clip duration={5}>
      <Video
        model={fal.videoModel("veed-fabric-1.0")}
        keepAudio
        prompt={{
          images: [IMAGE_PATH],
          audio: AUDIO_PATH,
        }}
        providerOptions={{
          fal: {
            resolution: RESOLUTION,
          },
        }}
      />
    </Clip>
  </Render>
);

async function main() {
  if (!process.env.FAL_API_KEY && !process.env.FAL_KEY) {
    console.error("ERROR: FAL_API_KEY/FAL_KEY not found in environment");
    process.exit(1);
  }

  const result = await render(video, {
    output: `output/veed-fabric-react-test-${RESOLUTION}.mp4`,
    cache: `.cache/ai-veed-fabric-${RESOLUTION}-keepaudio`,
  });

  console.log(
    `ok: output/veed-fabric-react-test-${RESOLUTION}.mp4 (${(result.video.byteLength / 1024 / 1024).toFixed(2)} MB)`,
  );
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
