// examples/async/strawberry-vs-chocolate.tsx
//
// A playful debate between Strawberry and Chocolate.
// Each "character" narrates their case using the reusable async Scene component.
// Demonstrates: await Speech, audio.duration, dynamic clip count,
// props-based scenes, image-to-video pipeline, captions per scene.
import { elevenlabs } from "../../../ai-sdk/providers/elevenlabs";
import { fal } from "../../../ai-sdk/providers/fal";
import { Captions, Clip, Image, Music, Render, Speech } from "../..";

// ---------------------------------------------------------------------------
// Reusable async Scene component
// ---------------------------------------------------------------------------
async function Scene({
  voice,
  script,
  character,
  style,
  photoPrompts,
  clipDuration = 2,
}: {
  voice: string;
  script: string;
  character: string;
  style: string;
  photoPrompts: string[];
  clipDuration?: number;
}) {
  const audio = await Speech({
    voice,
    model: elevenlabs.speechModel("eleven_turbo_v2"),
    children: script,
  });
  const numClips = Math.ceil(audio.duration / clipDuration);
  return (
    <Clip duration={audio.duration}>
      {Array.from({ length: numClips }, (_, i) => {
        const photo = photoPrompts[i % photoPrompts.length]!.replace(
          "${CHARACTER}",
          character,
        ).replace("${STYLE}", style);
        return (
          <Clip duration={clipDuration} key={photo}>
            <Image
              prompt={photo}
              model={fal.imageModel("nano-banana-pro")}
              aspectRatio="9:16"
              zoom="in"
            />
          </Clip>
        );
      })}
      <Captions src={audio} style="tiktok" position="bottom" withAudio />
    </Clip>
  );
}
// ---------------------------------------------------------------------------
// Character: Strawberry
// ---------------------------------------------------------------------------
const STRAWBERRY_STYLE =
  "vibrant food photography, macro lens, soft pink bokeh, dewy fresh, studio lighting, whimsical Pixar-like character energy";
const STRAWBERRY_PHOTOS = [
  "Close-up portrait of a cute anthropomorphic strawberry character, big expressive eyes, tiny leaf hat, speaking passionately, pink glowing background, ${STYLE}",
  "Medium shot, ${CHARACTER} standing proudly on a kitchen counter, arms crossed confidently, surrounded by fresh berries, morning sunlight, ${STYLE}",
  "Dramatic low angle, ${CHARACTER} standing tall on a slice of cheesecake like a throne, triumphant pose, sparkles and cream swirls, ${STYLE}",
  "Close-up, ${CHARACTER} whispering conspiratorially to camera, mischievous grin, soft focus background of a farmers market, ${STYLE}",
];
// ---------------------------------------------------------------------------
// Character: Chocolate
// ---------------------------------------------------------------------------
const CHOCOLATE_STYLE =
  "rich dark moody food photography, warm amber lighting, melting textures, luxurious feel, cinematic depth of field, Pixar-like character energy";
const CHOCOLATE_PHOTOS = [
  "Close-up portrait of a suave anthropomorphic chocolate bar character, smooth dark surface, confident smirk, golden wrapper like a cape, warm amber lighting, ${STYLE}",
  "Medium shot, ${CHARACTER} leaning against a cocoa bean, sophisticated pose, one eyebrow raised, steam rising from hot cocoa nearby, ${STYLE}",
  "Dramatic portrait, ${CHARACTER} emerging from a river of melted chocolate, powerful and majestic, golden rim lighting, ${STYLE}",
  "Close-up, ${CHARACTER} with a knowing smile, holding a tiny golden truffle like a microphone, dark velvet background, ${STYLE}",
];
// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------
export default (
  <Render width={1080} height={1920}>
    {/* @ts-expect-error — async JSX components are resolved via lazy resolution at render time */}
    <Scene
      voice="rachel"
      script="I am Strawberry. I am fresh, I am sweet, I am the queen of every dessert. You see me on cakes, in smoothies, dipped in chocolate. Wait, that last one does not count. The point is, everyone loves me. I am summer in a single bite."
      character="Strawberry"
      style={STRAWBERRY_STYLE}
      photoPrompts={STRAWBERRY_PHOTOS}
    />
    {/* @ts-expect-error — async JSX components are resolved via lazy resolution at render time */}
    <Scene
      voice="adam"
      script="Please. I am Chocolate. I have been royalty for three thousand years. The Aztecs called me the food of the gods. You are a seasonal fruit. I am eternal. I am in your birthday cake, your midnight craving. There is no contest."
      character="Chocolate"
      style={CHOCOLATE_STYLE}
      photoPrompts={CHOCOLATE_PHOTOS}
    />
  </Render>
);
