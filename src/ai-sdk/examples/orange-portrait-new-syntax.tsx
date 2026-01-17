import { openai } from "@ai-sdk/openai";
import type { ImageModelV3 } from "@ai-sdk/provider";
import { generateText } from "ai";
import { fal } from "../fal-provider";
import { Clip, Image, Render, Video, type VargElement } from "../react";
import type { VideoModelV3 } from "../video-model";

// character: young woman, short dark brown bob with wispy bangs, oval face, fair skin,
// large dark brown eyes, full lips, silver hoop earrings
// style: deep black bg, dramatic orange rim lighting, noir/premium aesthetic
const setting = async (params: {
  model: any;
  position: string;
  motion: string;
  lighting: string;
}) => {
  const result = await generateText({
    model: params.model,
    prompt: `${params.position} ${params.motion} ${params.lighting}`,
  });
  return result.text;
};

const optimize = async (
  text: string,
  options: {
    model: VideoModelV3 | ImageModelV3;
    params: Record<string, string>;
  },
) => {
  const paramsString = Object.entries(options.params)
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ");

  const optimized = await generateText({
    model: openai("gpt-5-nano"),
    prompt: `optimize prompt: ${text} for ${options.model.provider} ${options.model.modelId}, add the following parameters: ${paramsString}`,
  });

  return optimized.text;
};

function combine(strings: TemplateStringsArray, ...values: string[]) {
  return strings.reduce((acc, str, i) => acc + str + (values[i] || ""), "");
}

const LIGHTING = {
  STUDIO: "studio",
  ORANGE_RIM: "orange rim lighting",
  OUTDOORS: "outdoors",
  NOIR: "noir",
  PREMIUM: "premium aesthetic",
} as const;

const POSITION = {
  THREE_QUARTER: "three-quarter angle",
  PROFILE: "profile view",
  FRONT: "front view",
  CLOSE_UP: "close-up",
  SIDE_PROFILE: "side profile",
  WIDE_SHOT: "wide shot",
  THREE_QUARTER_FRONT: "three-quarter front view",
} as const;

const CAMERA_MOVEMENT = {
  BACK_SLOWLY: "camera moves back slowly",
  DOLLY_IN: "camera dollys in",
  STATIC: "camera static",
} as const;

const MOTION = {
  STEPS_BACK: "She steps back",
  LOOKS_AT_CAMERA: "She looks at camera",
  TURNS_SLIGHTLY: "She turns slightly to the side",
} as const;

const context = await setting({
  model: fal.imageModel("nano-banana-pro/edit"),
  lighting: LIGHTING.STUDIO,
  position: POSITION.THREE_QUARTER,
  motion: MOTION.STEPS_BACK,
});

console.log("DEBUG MOTION", context);

const Optimize = ({
  text,
  for: model,
  params,
}: {
  text: string;
  for: VideoModelV3 | ImageModelV3;
  params: Record<string, string>;
}): VargElement => {
  const optimized = optimize(text, { model, params });
  return <>{optimized}</>;
};

export default (
  <Render width={1080} height={1920}>
    <Clip duration={5}>
      <Video
        prompt={{
          images: [
            Image({
              prompt: {
                text: `Using the attached reference images, generate a photorealistic Three-quarter editorial portrait of the exact same character — maintain identical face, hairstyle, and proportions from Image 1.

                Framing: Head and shoulders, cropped at upper chest. Direct eye contact with camera.

                Natural confident expression, relaxed shoulders.
                Preserve the outfit neckline and visible clothing details from reference.

                Background: Deep black with two contrasting orange gradient accents matching Reference 2. Soft gradient bleed, no hard edges.

                Shot on 85mm f/1.4 lens, shallow depth of field. Clean studio lighting — soft key light on face, subtle rim light on hair and shoulders for separation. High-end fashion editorial aesthetic.`,
                images: [
                  "https://s3.varg.ai/uploads/images/1_0475e227.png",
                  "https://s3.varg.ai/uploads/images/xyearp51qvve-zi3nrcve-zbno2hfgt5gergjrof_995f553d.png",
                ],
              },
              model: fal.imageModel("nano-banana-pro/edit"),
            }),
          ],
          text: String(
            <Optimize
              text={`girl with a bob`}
              params={{
                lighting: "dramatic orange",
                position: POSITION.THREE_QUARTER,
                motion: MOTION.STEPS_BACK,
              }}
              for={fal.videoModel("kling-v2.5")}
            />,
          ),
        }}
        model={fal.videoModel("kling-v2.5")}
        duration={5}
      />
    </Clip>
  </Render>
);
