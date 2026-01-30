/**
 * Qwen Image Edit 2511 Multiple Angles Test
 *
 * Demonstrates camera angle adjustment using Qwen model.
 * Generates the same scene from different perspectives (azimuth/elevation).
 *
 * Run with: bun run src/cli/index.ts render src/react/examples/qwen-angles-test.tsx
 */

import { fal } from "../../ai-sdk/providers/fal";
import { Clip, Image, Render } from "..";

// Source image - replace with your own image URL or local path
const sourceImage =
  "https://v3b.fal.media/files/b/0a8973cb/qUbVwDCcMlvX4drBGYB1H.png";

export default (
  <Render width={1024} height={1024}>
    {/* Original image - front view */}
    <Clip duration={2}>
      <Image src={sourceImage} resize="cover" />
    </Clip>

    {/* Right side view (90 degrees horizontal) */}
    <Clip duration={2}>
      <Image
        prompt={{ text: "", images: [sourceImage] }}
        model={fal.imageModel("qwen-angles")}
        aspectRatio="1:1"
        providerOptions={{
          fal: {
            horizontal_angle: 90,
            vertical_angle: 0,
            zoom: 5,
          },
        }}
      />
    </Clip>

    {/* Bird's eye view (60 degrees vertical) */}
    <Clip duration={2}>
      <Image
        prompt={{ text: "", images: [sourceImage] }}
        model={fal.imageModel("qwen-angles")}
        aspectRatio="1:1"
        providerOptions={{
          fal: {
            horizontal_angle: 0,
            vertical_angle: 60,
            zoom: 5,
          },
        }}
      />
    </Clip>

    {/* Close-up from 45 degree angle */}
    <Clip duration={2}>
      <Image
        prompt={{ text: "", images: [sourceImage] }}
        model={fal.imageModel("qwen-angles")}
        aspectRatio="1:1"
        providerOptions={{
          fal: {
            horizontal_angle: 45,
            vertical_angle: 30,
            zoom: 8,
          },
        }}
      />
    </Clip>
  </Render>
);
