import { fal } from "../fal-provider";
import { Clip, Image, Render, render, Title } from "../react";

async function main() {
  console.log("rendering varg-react video...\n");

  const video = (
    <Render width={720} height={720} fps={30}>
      <Clip duration={3}>
        <Image
          prompt="fat tiger lying on couch, cute, pixar style"
          model={fal.imageModel("flux-schnell")}
          zoom="in"
        />
        <Title position="bottom" color="#ffffff">
          DAY 1
        </Title>
      </Clip>

      <Clip duration={3} transition={{ name: "fade", duration: 0.5 }}>
        <Image
          prompt="fat tiger still on couch, slightly fatter, pizza boxes, pixar style"
          model={fal.imageModel("flux-schnell")}
          zoom="in"
        />
        <Title position="bottom" color="#ffffff">
          DAY 365
        </Title>
      </Clip>
    </Render>
  );

  console.log("video tree:", JSON.stringify(video, null, 2));

  const buffer = await render(video, {
    output: "output/react-test.mp4",
    cache: ".cache/ai",
  });

  console.log(`\ndone! ${buffer.byteLength} bytes`);
  console.log("output: output/react-test.mp4");
}

main().catch(console.error);
