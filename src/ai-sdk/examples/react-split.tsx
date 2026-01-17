import { fal } from "../fal-provider";
import { Clip, Image, Render, render, SplitLayout as Split, Title } from "../react";

// Reference images
const REF_IMAGE_1 = "/Users/aleksandrmalysev/Yandex.Disk.localized/Developer/vargHQ/py-sdk-v02/media/launch_video/showcase/chars/21.png";
const REF_IMAGE_2 = "/Users/aleksandrmalysev/Yandex.Disk.localized/Developer/vargHQ/py-sdk-v02/media/launch_video/showcase/varg-patterns/main.png";

async function readFile(path: string) {
  const file = Bun.file(path);
  return file.arrayBuffer();
}

async function main() {
  console.log("creating split screen with nano-banana-pro/edit...\n");

  // Read reference images
  const ref1Data = await readFile(REF_IMAGE_1);
  const ref2Data = await readFile(REF_IMAGE_2);

  const basePrompt = "Photorealistic full-length front portrait of the same character from the reference with consistent face, hairstyle, proportions. Clean, minimal studio lighting. Natural relaxed posture, hands by her sides. High detail in clothing texture and stitching.";

  const left = Image({
    prompt: {
      text: `${basePrompt} Wearing casual outfit.`,
      images: [ref1Data],
    },
    model: fal.imageModel("nano-banana-pro/edit"),
    aspectRatio: "9:16",
  });

  const right = Image({
    prompt: {
      text: `${basePrompt} Wearing elegant evening dress.`,
      images: [ref2Data],
    },
    model: fal.imageModel("nano-banana-pro/edit"),
    aspectRatio: "9:16",
  });

  const video = (
    <Render width={1080} height={1920}>
      <Clip duration={5}>
        <Split left={left} right={right} />
        <Title position="bottom" color="#ffffff">
          Day to Night
        </Title>
      </Clip>
    </Render>
  );

  const buffer = await render(video, {
    output: "output/react-split.mp4",
    cache: ".cache/ai",
  });

  console.log(`\ndone! ${buffer.byteLength} bytes`);
  console.log("output: output/react-split.mp4");
}

main().catch(console.error);
