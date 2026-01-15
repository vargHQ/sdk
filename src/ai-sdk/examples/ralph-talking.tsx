import { elevenlabs } from "../elevenlabs-provider";
import { fal } from "../fal-provider";
import {
  Animate,
  Clip,
  Image,
  Render,
  render,
  Speech,
  Title,
  type VargElement,
} from "../react";

// TalkingHead is just a composition of primitives
const TalkingHead = ({
  character,
  voice,
  children,
}: {
  character: string;
  voice: string;
  children: string;
}) => (
  <>
    <Animate
      image={Image({
        prompt: character,
        model: fal.imageModel("flux-schnell"),
      })}
      model={fal.videoModel("wan-2.5")}
      motion="subtle head movements, blinking, mouth moving"
    />
    <Speech voice={voice} model={elevenlabs.speechModel("turbo")}>
      {children}
    </Speech>
  </>
);

const script = `Hi, I'm Ralph! My cat's breath smells like cat food. 
Also I invested my lunch money in dogecoin. 
Now I live in a box. But it's a nice box! 
It has a window. The window is a hole.`;

async function main() {
  console.log("rendering ralph talking head...\n");
  console.log("script:", script);

  const video = (
    <Render width={1080} height={1920}>
      <Clip duration={10}>
        <TalkingHead
          character="ralph wiggum, simpsons style, innocent smile, slightly confused"
          voice="adam"
        >
          {script}
        </TalkingHead>
      </Clip>

      <Clip duration={2} transition={{ name: "fade", duration: 0.5 }}>
        <Image
          prompt="ralph wiggum in cardboard box, happy, simpsons style"
          model={fal.imageModel("flux-schnell")}
          zoom="in"
        />
        <Title position="bottom">@RalphInvests</Title>
      </Clip>
    </Render>
  );

  console.log("\nvideo tree:", JSON.stringify(video, null, 2));

  const buffer = await render(video, {
    output: "output/ralph-talking.mp4",
    cache: ".cache/ai",
  });

  console.log(`\ndone! ${buffer.byteLength} bytes`);
  console.log("output: output/ralph-talking.mp4");
}

main().catch(console.error);
