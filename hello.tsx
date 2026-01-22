import { fal } from "vargai/ai";
import { assets, Clip, Image, Render, Video } from "vargai/react";

const girl = Image({
  prompt: {
    text: `Using the attached reference images, generate a photorealistic three-quarter editorial portrait of the exact same character — maintain identical face, hairstyle, and proportions from Image 1.

Framing: Head and shoulders, cropped at upper chest. Direct eye contact with camera.

Natural confident expression, relaxed shoulders.
Preserve the outfit neckline and visible clothing details from reference.

Background: Deep black with two contrasting orange gradient accents matching Reference 2. Soft gradient bleed, no hard edges.

Shot on 85mm f/1.4 lens, shallow depth of field. Clean studio lighting — soft key light on face, subtle rim light on hair and shoulders for separation. High-end fashion editorial aesthetic.`,
    images: [assets.characters.orangeGirl, assets.backgrounds.orangeGradient],
  },
  model: fal.imageModel("nano-banana-pro/edit"),
  aspectRatio: "9:16",
});

export default (
  <Render width={1080} height={1920}>
    <Clip duration={5}>
      <Video
        prompt={{
          text: "She waves hello warmly, natural smile, friendly expression. Studio lighting, authentic confident slightly playful atmosphere. Camera static. Intense orange lighting.",
          images: [girl],
        }}
        model={fal.videoModel("kling-v2.5")}
      />
    </Clip>
  </Render>
);
