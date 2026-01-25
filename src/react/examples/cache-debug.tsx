import { fal } from "vargai/ai";
import { Clip, Image, Render, Video } from "vargai/react";

// Run with:
// VARG_CACHE_LOG=1 bun run src/cli/index.ts render src/react/examples/cache-debug.tsx

const baseImage = Image({
  prompt: "A cozy cabin in a snowy forest at sunset, cinematic lighting",
  model: fal.imageModel("flux-schnell"),
  aspectRatio: "9:16",
});

const baseVideoPrompt = {
  text: "Slow camera push-in, gentle snowfall, warm glow from windows.",
  images: [baseImage],
};

const videoA = Video({
  prompt: baseVideoPrompt,
  model: fal.videoModel("wan-2.5"),
  aspectRatio: "9:16",
  cutFrom: 0.2,
  cutTo: 3.0,
  left: "0%",
  width: "100%",
});

const videoB = Video({
  prompt: baseVideoPrompt,
  model: fal.videoModel("wan-2.5"),
  aspectRatio: "9:16",
  cutFrom: 1.0,
  cutTo: 4.0,
  left: "10%",
  width: "80%",
});

const videoC = Video({
  prompt: baseVideoPrompt,
  model: fal.videoModel("wan-2.5"),
  aspectRatio: "9:16",
  cutFrom: 0.5,
  cutTo: 2.5,
  left: "5%",
  width: "90%",
});

export default (
  <Render width={1080} height={1920}>
    <Clip duration={3}>{videoA}</Clip>
    <Clip duration={3}>{videoB}</Clip>
    <Clip duration={3}>{videoC}</Clip>
  </Render>
);
