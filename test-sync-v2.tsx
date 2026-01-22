/**
 * Simple sync-v2 lipsync test in React format
 * Takes an existing video + audio and lipsyncs them together
 *
 * Run: bunx vargai render test-sync-v2.tsx
 */
import { fal } from "vargai/ai";
import { Clip, Render, Video } from "vargai/react";

// Source video (existing talking head video)
const SOURCE_VIDEO = "output/extracted-videos/tyler/tyler-10.mp4";

// Source audio (pre-generated speech)
const SOURCE_AUDIO = "output/test-speech.mp3";

export default (
  <Render width={1080} height={1920}>
    <Clip duration={10}>
      {/* Lipsync: video + audio -> sync-v2 */}
      <Video
        prompt={{
          video: SOURCE_VIDEO,
          audio: SOURCE_AUDIO,
        }}
        model={fal.videoModel("sync-v2")}
      />
    </Clip>
  </Render>
);
