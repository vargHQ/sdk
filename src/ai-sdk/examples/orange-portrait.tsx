import { fal } from "../fal-provider";
import { Clip, Image, Render, Video } from "../react";

export default (
  <Render width={1080} height={1920}>
    <Clip duration={5}>
      <Video
        prompt={{
          text: "She steps back, and the camera shows more and more of her body until she appears fully in the frame. The lighting is studio, and the atmosphere is authentic, confident, and slightly playful. Camera static. Intense orange lighting.",
          images: [
            Image({
              prompt: {
                text: "Using the attached reference images, generate a photorealistic close-up editorial portrait of the exact same character — maintain identical face, hairstyle, and proportions from Image 1. Framing: Head and shoulders, cropped at upper chest. Direct eye contact with camera. Natural confident expression, relaxed shoulders. Preserve the outfit neckline and visible clothing details from reference. Background: Deep black with two contrasting orange gradient accents matching Reference 2. Soft gradient bleed, no hard edges. Shot on 85mm f/1.4 lens, shallow depth of field. Clean studio lighting — soft key light on face, subtle rim light on hair and shoulders for separation. High-end fashion editorial aesthetic.",
                images: [
                  "https://s3.varg.ai/uploads/images/1_0475e227.png",
                  "https://s3.varg.ai/uploads/images/xyearp51qvve-zi3nrcve-zbno2hfgt5gergjrof_995f553d.png",
                ],
              },
              model: fal.imageModel("nano-banana-pro/edit"),
            }),
          ],
        }}
        model={fal.videoModel("kling-v2.5")}
        duration={5}
      />
    </Clip>
  </Render>
);
