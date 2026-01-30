/**
 * Launch Video #6: Kawaii Fruit Characters
 *
 * 4 cute fruit characters that wave and say hi, then appear together.
 * Uses nano-banana-pro for images, kling for animation.
 *
 * Run: bunx vargai render launch-videos/06-kawaii-fruits.tsx
 */
import { elevenlabs, fal } from "vargai/ai";
import { Clip, Image, Music, Render, Video } from "vargai/react";

// Base style for all characters
const BASE_STYLE =
  "round plush body with fuzzy felt texture, small black dot eyes, tiny curved smile, four small round feet, soft studio lighting, 3D render, minimal design, warm cozy aesthetic, Pixar style cuteness";

// 4 Kawaii fruit characters
const CHARACTERS = [
  {
    name: "orange",
    prompt: `Cute kawaii fluffy orange fruit character, ${BASE_STYLE}, green leaf on top, solid orange background matching the character`,
    color: "orange",
  },
  {
    name: "strawberry",
    prompt: `Cute kawaii fluffy strawberry fruit character, ${BASE_STYLE}, tiny green leaves on top, small yellow seeds on body, solid pink-red background matching the character`,
    color: "pink",
  },
  {
    name: "lemon",
    prompt: `Cute kawaii fluffy lemon fruit character, ${BASE_STYLE}, small green leaf on top, solid yellow background matching the character`,
    color: "yellow",
  },
  {
    name: "blueberry",
    prompt: `Cute kawaii fluffy blueberry fruit character, ${BASE_STYLE}, tiny crown on top, solid blue-purple background matching the character`,
    color: "blue",
  },
];

// Generate individual character images
const characterImages = CHARACTERS.map((char) =>
  Image({
    prompt: char.prompt,
    model: fal.imageModel("nano-banana-pro"),
    aspectRatio: "9:16",
  }),
);

const combinedImage = Image({
  prompt: {
    text: `Four cute kawaii fluffy fruit characters standing together in a row: orange, strawberry, lemon, and blueberry. ${BASE_STYLE}. All characters waving hello together, pastel rainbow gradient background, group photo composition, centered framing`,
    images: characterImages,
  },
  model: fal.imageModel("nano-banana-pro/edit"),
  aspectRatio: "9:16",
});

export default (
  <Render width={1080} height={1920}>
    {/* Catchy baby-style music */}
    <Music
      prompt="cute baby song, tytytyttyry babie tytyry tytyty babie style, playful xylophone melody, cheerful and innocent, kawaii vibes, simple repetitive tune, nursery rhyme feel"
      model={elevenlabs.musicModel()}
      volume={0.7}
    />

    {/* Scene 1-4: Each character waves individually */}
    {characterImages.map((charImage, i) => (
      <Clip key={CHARACTERS[i]?.name ?? i} duration={2.5}>
        <Video
          prompt={{
            text: "character waves hello enthusiastically, bounces up and down slightly, eyes squint with joy, tiny feet wiggle",
            images: [charImage],
          }}
          model={fal.videoModel("kling-v2.5")}
          duration={5}
        />
      </Clip>
    ))}

    {/* Scene 5: All 4 characters together waving */}
    <Clip duration={4}>
      <Video
        prompt={{
          text: "all four fruit characters wave hello together in sync, bouncing happily, celebrating together, joyful group animation",
          images: [combinedImage],
        }}
        model={fal.videoModel("kling-v2.5")}
        duration={5}
      />
    </Clip>
  </Render>
);
