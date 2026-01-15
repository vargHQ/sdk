import { fal } from "../fal-provider";
import { Clip, Image, render, Title, Video } from "../react";

const script = `Hi, I'm Ralph! My cat's breath smells like cat food. 
Also I invested my lunch money in dogecoin. 
Now I live in a box. But it's a nice box! 
It has a window. The window is a hole.`;

async function main() {
  console.log("rendering ralph crypto video...\n");

  const video = (
    <Video width={1080} height={1920}>
      <Clip duration={4}>
        <Image
          prompt="ralph wiggum, simpsons style, innocent smile, slightly confused, holding phone showing crypto chart going down"
          model={fal.imageModel("flux-schnell")}
          zoom="in"
        />
        <Title position="bottom" color="#ffff00">
          FINANCIAL ADVICE
        </Title>
      </Clip>

      <Clip duration={3} transition={{ name: "fade", duration: 0.5 }}>
        <Image
          prompt="ralph wiggum looking at empty wallet, simpsons style, confused but happy"
          model={fal.imageModel("flux-schnell")}
          zoom="out"
        />
        <Title position="bottom" color="#ffffff">
          IM IN DANGER
        </Title>
      </Clip>

      <Clip duration={3} transition={{ name: "fade", duration: 0.5 }}>
        <Image
          prompt="ralph wiggum in cardboard box, happy, simpsons style, box has 'CEO' written on it"
          model={fal.imageModel("flux-schnell")}
          zoom="in"
        />
        <Title position="bottom" color="#ffffff">
          @RalphInvests
        </Title>
      </Clip>
    </Video>
  );

  console.log("script:", script);
  console.log("\nvideo tree:", JSON.stringify(video, null, 2));

  const buffer = await render(video, {
    output: "output/ralph-crypto.mp4",
    cache: ".cache/ai",
  });

  console.log(`\ndone! ${buffer.byteLength} bytes`);
  console.log("output: output/ralph-crypto.mp4");
}

main().catch(console.error);
