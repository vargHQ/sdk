/**
 * Example: Simple animated video
 * Run: bun run examples/my-first-video.tsx
 */
import { render, Render, Clip, Image, Animate } from "vargai/react";
import { fal } from "vargai/ai";

async function main() {
  console.log("Creating your first AI video...\n");

  await render(
    <Render width={720} height={720}>
      <Clip duration={3}>
        <Animate
          image={Image({
            prompt: "a friendly robot waving hello, cartoon style, blue colors",
            model: fal.imageModel("flux-schnell"),
            aspectRatio: "1:1",
          })}
          motion="robot waves hello, friendly gesture"
          model={fal.videoModel("wan-2.5")}
          duration={3}
        />
      </Clip>
    </Render>,
    { 
      output: "output/my-first-video.mp4",
      cache: ".cache/ai"
    }
  );

  console.log("\nDone! Check output/my-first-video.mp4");
}

main().catch(console.error);
