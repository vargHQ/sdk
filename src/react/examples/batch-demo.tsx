/** @jsxImportSource vargai */

import { fal } from "vargai/ai";
import { Batch, Clip, Image, Render, Video } from "vargai/react";

const HOOKS = [
  "Stop satisfying everyone around you",
  "Your comfort zone is killing your potential",
  "Nobody is coming to save you",
  "The only limit is your imagination",
];

const character = Image({
  prompt: "confident young entrepreneur, casual hoodie, minimalist background",
  model: fal.imageModel("flux-schnell"),
  aspectRatio: "9:16",
});

export default (
  <Batch parallel={2} output="output/hooks">
    {HOOKS.map((hook) => (
      <Render
        key={hook}
        name={hook.toLowerCase().replace(/\s+/g, "-")}
        width={1080}
        height={1920}
      >
        <Clip duration={5}>
          <Video
            prompt={{
              text: `person speaking directly to camera: "${hook}"`,
              images: [character],
            }}
            model={fal.videoModel("kling-v2.5")}
          />
        </Clip>
      </Render>
    ))}
  </Batch>
);
