import { fal } from "../fal-provider";
import { Animate, Clip, Image, Music, Render, render } from "../react";

const MADI_REF =
  "https://s3.varg.ai/fellowers/madi/character_shots/madi_shot_03_closeup.png";

const SCENES = [
  {
    prompt: "eating a peach, juice dripping, eyes closed enjoying",
    motion: "subtle head movement, chewing motion, juice dripping slowly",
  },
  {
    prompt: "holding peach near face, soft smile, looking at camera",
    motion: "gentle breathing, slight smile widening, eyes blinking",
  },
  {
    prompt: "looking to the side thoughtfully, peach in hand",
    motion: "slow head turn, contemplative expression, hand adjusting grip",
  },
  {
    prompt: "laughing, throwing the peach playfully, joyful expression",
    motion: "laughing motion, arm throwing upward, hair bouncing",
  },
];

async function main() {
  console.log("creating madi peach video (animated)...\n");

  const video = (
    <Render width={1080} height={1920}>
      <Music src="./output/duet-mixed.mp4" duration={4 * 2} />

      {SCENES.map((scene, i) => (
        <Clip key={i} duration={2}>
          <Animate
            image={Image({
              prompt: { text: scene.prompt, images: [MADI_REF] },
              model: fal.imageModel("nano-banana-pro/edit"),
              aspectRatio: "9:16",
              resize: "cover",
            })}
            motion={scene.motion}
            model={fal.videoModel("wan-2.5")}
            duration={5}
          />
        </Clip>
      ))}
    </Render>
  );

  console.log("rendering", SCENES.length, "animated clips in parallel...");

  const buffer = await render(video, {
    output: "output/react-madi.mp4",
    cache: ".cache/ai",
  });

  console.log(`\ndone! ${buffer.byteLength} bytes`);
  console.log("output: output/react-madi.mp4");
}

main().catch(console.error);
