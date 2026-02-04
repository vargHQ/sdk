import { fal } from "../../ai-sdk/providers/fal";
import { Clip, Image, Render, render, Split, Title } from "..";

async function main() {
  console.log("creating before/after split screen...\n");

  const before = Image({
    prompt:
      "overweight man sitting on couch, tired expression, pale skin, messy hair, wearing stained t-shirt",
    model: fal.imageModel("flux-schnell"),
  });

  const after = Image({
    prompt:
      "fit muscular man standing confidently, tanned skin, bright smile, wearing fitted athletic shirt",
    model: fal.imageModel("flux-schnell"),
  });

  const video = (
    <Render width={1920} height={1080}>
      <Clip duration={5}>
        <Split>{[before, after]}</Split>
        <Title position="bottom" color="#ffffff">
          30 Day Transformation
        </Title>
      </Clip>
    </Render>
  );

  console.log("video tree:", JSON.stringify(video, null, 2));

  const buffer = await render(video, {
    output: "output/react-split.mp4",
    cache: ".cache/ai",
  });

  console.log(`\ndone! ${buffer.byteLength} bytes`);
  console.log("output: output/react-split.mp4");
}

main().catch(console.error);
