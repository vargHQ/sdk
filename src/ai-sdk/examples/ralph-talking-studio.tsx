import { elevenlabs } from "../elevenlabs-provider";
import { fal } from "../fal-provider";
import {
  Animate,
  Clip,
  Image,
  Render,
  Speech,
  Title,
} from "../react";

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

export default (
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
