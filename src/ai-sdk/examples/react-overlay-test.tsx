import { fal } from "../fal-provider";
import { Clip, Image, Overlay, Render, render, Title, Video } from "../react";

async function main() {
  console.log("testing continuous overlay...\n");

  const video = (
    <Render width={1280} height={720} fps={30}>
      <Overlay left={0.73} top={0.73} width={0.25} height={0.25} keepAudio>
        <Video src="./output/workflow-talking-synced.mp4" keepAudio />
      </Overlay>

      <Clip duration={2}>
        <Image
          prompt="modern coffee shop interior, warm lighting"
          model={fal.imageModel("flux-schnell")}
          zoom="in"
        />
        <Title position="bottom">Scene 1: Coffee Shop</Title>
      </Clip>

      <Clip duration={2} transition={{ name: "fade", duration: 0.3 }}>
        <Image
          prompt="beautiful park with autumn leaves, golden hour"
          model={fal.imageModel("flux-schnell")}
          zoom="out"
        />
        <Title position="bottom">Scene 2: Park Walk</Title>
      </Clip>

      <Clip duration={2} transition={{ name: "fade", duration: 0.3 }}>
        <Image
          prompt="cozy home office with big window, modern desk"
          model={fal.imageModel("flux-schnell")}
          zoom="in"
        />
        <Title position="bottom">Scene 3: Home Office</Title>
      </Clip>
    </Render>
  );

  console.log("video tree:", JSON.stringify(video, null, 2));

  const buffer = await render(video, {
    output: "output/react-overlay-test.mp4",
    cache: ".cache/ai",
  });

  console.log(`\ndone! ${buffer.byteLength} bytes`);
  console.log("output: output/react-overlay-test.mp4");
}

main().catch(console.error);
