import { fal } from "vargai/ai";
import { Clip, Image, Render, Video } from "vargai/react";

const portrait = Image({
  prompt: {
    text: "Using the attached reference images, generate a photorealistic Three-quarter editorial portrait of the exact same character — maintain identical face, hairstyle, and proportions from Image 1. Framing: Head and shoulders, cropped at upper chest. Direct eye contact with camera. Natural confident expression, relaxed shoulders. Preserve the outfit neckline and visible clothing details from reference. Background: Deep black with two contrasting orange gradient accents matching Reference 2. Soft gradient bleed, no hard edges. Shot on 85mm f/1.4 lens, shallow depth of field. Clean studio lighting — soft key light on face, subtle rim light on hair and shoulders for separation. High-end fashion editorial aesthetic.",
    images: ["https://s3.varg.ai/person.png", "https://s3.varg.ai/bg.png"],
  },
  model: fal.imageModel("nano-banana-pro/edit"),
});

export default (
  <Render width={1080} height={1920}>
    <Clip duration={5}>
      <Video
        prompt={{
          text: "She steps back, camera reveals more of her body until she appears fully in frame. Studio lighting, authentic confident slightly playful atmosphere. Camera static. She poses naturally, first looking straight at camera, then turning slightly to the side to show her figure in profile. Intense orange lighting.",
          images: [portrait],
        }}
        model={fal.videoModel("kling-v2.5")}
      />
    </Clip>
  </Render>
);
