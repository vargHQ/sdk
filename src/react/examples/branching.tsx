import { elevenlabs } from "../../ai-sdk/elevenlabs-provider";
import { fal } from "../../ai-sdk/fal-provider";
import { Animate, Clip, Image, Render, Speech, Title } from "..";

// Non-linear tree: multiple clips with independent branches
// Clip 1: TalkingHead (Image -> Animate + Speech)
// Clip 2: Split comparison (2 independent Images)
// Clip 3: Product shot with music

const character = Image({
  prompt:
    "friendly tech reviewer, young man with glasses, studio lighting, professional headshot",
  model: fal.imageModel("flux-schnell"),
});

const _productBefore = Image({
  prompt:
    "old smartphone, cracked screen, slow, outdated design, on white background",
  model: fal.imageModel("flux-schnell"),
});

const _productAfter = Image({
  prompt:
    "sleek new smartphone, edge-to-edge display, premium design, on white background",
  model: fal.imageModel("flux-schnell"),
});

const packshot = Image({
  prompt:
    "smartphone floating with gradient background, product photography, premium feel",
  model: fal.imageModel("flux-schnell"),
});

export default (
  <Render width={1080} height={1920}>
    {/* Clip 1: Talking head intro */}
    <Clip duration={5}>
      <Animate
        image={character}
        model={fal.videoModel("wan-2.5")}
        motion="talking naturally, slight head movements, friendly expression"
      />
      <Speech voice="adam" model={elevenlabs.speechModel("turbo")}>
        Hey everyone! Today we're looking at the biggest smartphone upgrade of
        the year.
      </Speech>
    </Clip>

    {/* Clip 2: Before/after comparison - branches into 2 images */}
    <Clip duration={4} transition={{ name: "fade", duration: 0.5 }}>
      <Image
        prompt="split screen comparison layout"
        model={fal.imageModel("flux-schnell")}
      />
      <Title position="top">Before vs After</Title>
    </Clip>

    {/* Clip 3: Product packshot */}
    <Clip duration={3} transition={{ name: "fade", duration: 0.5 }}>
      {packshot}
      <Title position="bottom" color="#ffffff">
        Available Now
      </Title>
    </Clip>
  </Render>
);
