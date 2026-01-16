import { fal } from "../fal-provider";
import { Clip, Image, Music, Render, render } from "../react";

const MADI_REF = "https://s3.varg.ai/fellowers/madi/character_shots/madi_shot_03_closeup.png";

const SCENES = [
  "eating a peach, juice dripping, eyes closed enjoying",
  "holding peach near face, soft smile, looking at camera",
  "looking to the side thoughtfully, peach in hand",
  "laughing, throwing the peach playfully, joyful expression",
];

async function main() {
  console.log("creating madi peach video (image-to-image edit)...\n");

  const video = (
    <Render width={1080} height={1920}>
      <Music src="https://s3.varg.ai/fellowers/madi/voice_samples/4_sarah_test.mp3" />

      {SCENES.map((scene, i) => (
        <Clip key={i} duration={2} transition={{ name: "fade", duration: 0.3 }}>
          <Image
            prompt={{ text: scene, images: [MADI_REF] }}
            model={fal.imageModel("nano-banana-pro/edit")}
            aspectRatio="9:16"
            resize="cover"
          />
        </Clip>
      ))}
    </Render>
  );

  console.log("rendering", SCENES.length, "clips in parallel...");

  const buffer = await render(video, {
    output: "output/react-madi.mp4",
    cache: ".cache/ai",
  });

  console.log(`\ndone! ${buffer.byteLength} bytes`);
  console.log("output: output/react-madi.mp4");
}

main().catch(console.error);
