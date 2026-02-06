/**
 * Qwen Image Edit 2511 Multiple Angles action
 * Generates same scene from different camera angles (azimuth/elevation)
 */

import { fal } from "@fal-ai/client";
import { z } from "zod";
import { filePathSchema } from "../../core/schema/shared";
import type { ActionDefinition, ZodSchema } from "../../core/schema/types";
import { ensureUrl, logQueueUpdate } from "./utils";

// Input schema with Zod
const qwenAnglesInputSchema = z.object({
  image: filePathSchema.describe("Input image to adjust camera angle for"),
  horizontalAngle: z
    .number()
    .min(0)
    .max(360)
    .default(0)
    .describe(
      "Horizontal rotation angle in degrees. 0=front, 90=right side, 180=back, 270=left side, 360=front",
    ),
  verticalAngle: z
    .number()
    .min(-30)
    .max(90)
    .default(0)
    .describe(
      "Vertical camera angle in degrees. -30=looking up, 0=eye-level, 30=elevated, 60=high-angle, 90=bird's-eye",
    ),
  zoom: z
    .number()
    .min(0)
    .max(10)
    .default(5)
    .describe(
      "Camera zoom/distance. 0=wide shot (far), 5=medium shot (normal), 10=close-up (very close)",
    ),
  prompt: z
    .string()
    .optional()
    .describe(
      "Additional text to append to the automatically generated prompt",
    ),
  loraScale: z
    .number()
    .min(0)
    .max(4)
    .default(1)
    .describe("Strength of the camera control effect"),
  guidanceScale: z
    .number()
    .min(1)
    .max(20)
    .default(4.5)
    .describe("CFG (Classifier Free Guidance) scale"),
  numInferenceSteps: z
    .number()
    .min(1)
    .max(50)
    .default(28)
    .describe("Number of inference steps"),
  negativePrompt: z
    .string()
    .default("")
    .describe("Negative prompt for the generation"),
  seed: z.number().optional().describe("Random seed for reproducibility"),
  outputFormat: z
    .enum(["png", "jpeg", "webp"])
    .default("png")
    .describe("Output image format"),
  numImages: z
    .number()
    .min(1)
    .max(4)
    .default(1)
    .describe("Number of images to generate"),
});

// Output schema with Zod
const qwenAnglesOutputSchema = z.object({
  imageUrl: z.string(),
  images: z.array(z.object({ url: z.string() })).optional(),
  seed: z.number().optional(),
  prompt: z.string().optional(),
});

// Schema object for the definition
const schema: ZodSchema<
  typeof qwenAnglesInputSchema,
  typeof qwenAnglesOutputSchema
> = {
  input: qwenAnglesInputSchema,
  output: qwenAnglesOutputSchema,
};

export const definition: ActionDefinition<typeof schema> = {
  type: "action",
  name: "qwen-angles",
  description:
    "Adjust camera angle of an image using Qwen Image Edit 2511 Multiple Angles",
  schema,
  routes: [
    {
      target: "fal-ai/qwen-image-edit-2511-multiple-angles",
      priority: 10,
    },
  ],
  execute: async (inputs) => {
    const {
      image,
      horizontalAngle,
      verticalAngle,
      zoom,
      prompt,
      loraScale,
      guidanceScale,
      numInferenceSteps,
      negativePrompt,
      seed,
      outputFormat,
      numImages,
    } = inputs;

    console.log("[action/qwen-angles] adjusting camera angle");

    const imageUrl = await ensureUrl(image);
    const result = await fal.subscribe(
      "fal-ai/qwen-image-edit-2511-multiple-angles",
      {
        input: {
          image_urls: [imageUrl],
          horizontal_angle: horizontalAngle ?? 0,
          vertical_angle: verticalAngle ?? 0,
          zoom: zoom ?? 5,
          additional_prompt: prompt,
          lora_scale: loraScale ?? 1,
          guidance_scale: guidanceScale ?? 4.5,
          num_inference_steps: numInferenceSteps ?? 28,
          acceleration: "regular",
          negative_prompt: negativePrompt ?? "",
          seed,
          output_format: outputFormat ?? "png",
          num_images: numImages ?? 1,
        },
        logs: true,
        onQueueUpdate: logQueueUpdate("qwen-angles"),
      },
    );

    const data = result.data as {
      images?: Array<{ url: string }>;
      seed?: number;
      prompt?: string;
    };

    const images = data?.images;
    const firstImage = images?.[0];
    if (!images || !firstImage) {
      throw new Error("No images in result");
    }

    return {
      imageUrl: firstImage.url,
      images,
      seed: data?.seed,
      prompt: data?.prompt,
    };
  },
};

// Re-export types for convenience
export type QwenAnglesInput = z.infer<typeof qwenAnglesInputSchema>;
export type QwenAnglesOutput = z.infer<typeof qwenAnglesOutputSchema>;

// Convenience function
export async function qwenAngles(
  imageUrl: string,
  options: {
    horizontalAngle?: number;
    verticalAngle?: number;
    zoom?: number;
    prompt?: string;
    loraScale?: number;
    guidanceScale?: number;
    numInferenceSteps?: number;
    negativePrompt?: string;
    seed?: number;
    outputFormat?: "png" | "jpeg" | "webp";
    numImages?: number;
  } = {},
): Promise<QwenAnglesOutput> {
  console.log("[qwen-angles] adjusting camera angle");

  const url = await ensureUrl(imageUrl);
  const result = await fal.subscribe(
    "fal-ai/qwen-image-edit-2511-multiple-angles",
    {
      input: {
        image_urls: [url],
        horizontal_angle: options.horizontalAngle ?? 0,
        vertical_angle: options.verticalAngle ?? 0,
        zoom: options.zoom ?? 5,
        additional_prompt: options.prompt,
        lora_scale: options.loraScale ?? 1,
        guidance_scale: options.guidanceScale ?? 4.5,
        num_inference_steps: options.numInferenceSteps ?? 28,
        acceleration: "regular",
        negative_prompt: options.negativePrompt ?? "",
        seed: options.seed,
        output_format: options.outputFormat ?? "png",
        num_images: options.numImages ?? 1,
      },
      logs: true,
      onQueueUpdate: logQueueUpdate("qwen-angles"),
    },
  );

  const data = result.data as {
    images?: Array<{ url: string }>;
    seed?: number;
    prompt?: string;
  };

  const images = data?.images;
  const firstImage = images?.[0];
  if (!images || !firstImage) {
    throw new Error("No images in result");
  }

  return {
    imageUrl: firstImage.url,
    images,
    seed: data?.seed,
    prompt: data?.prompt,
  };
}

export default definition;
