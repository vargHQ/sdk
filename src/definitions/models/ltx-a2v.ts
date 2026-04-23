/**
 * LTX-2 19B Audio-to-Video
 * Generate video with audio from audio, text and optional images
 */

import { z } from "zod";
import { urlSchema } from "../../core/schema/shared";
import type {
  ModelDefinition,
  ProviderPricing,
  ZodSchema,
} from "../../core/schema/types";

const cameraLoraSchema = z
  .enum([
    "dolly_in",
    "dolly_out",
    "dolly_left",
    "dolly_right",
    "jib_up",
    "jib_down",
    "static",
    "none",
  ])
  .describe("Camera movement LoRA");

const accelerationSchema = z
  .enum(["none", "regular", "high", "full"])
  .describe("Acceleration level");

const videoOutputTypeSchema = z
  .enum(["X264 (.mp4)", "VP9 (.webm)", "PRORES4444 (.mov)", "GIF (.gif)"])
  .describe("Output video format");

const videoQualitySchema = z
  .enum(["low", "medium", "high", "maximum"])
  .describe("Output video quality");

// Input schema with Zod
const ltxA2vInputSchema = z.object({
  prompt: z.string().describe("The prompt to generate the video from"),
  audio_url: urlSchema.describe(
    "The URL of the audio to generate the video from",
  ),
  image_url: urlSchema
    .optional()
    .describe("Optional URL of an image to use as the first frame"),
  end_image_url: urlSchema
    .optional()
    .describe("Optional URL of an image to use as the end frame"),
  match_audio_length: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "When enabled, num_frames is calculated from audio duration and FPS",
    ),
  num_frames: z
    .number()
    .int()
    .min(9)
    .max(481)
    .optional()
    .default(121)
    .describe(
      "Number of frames to generate (used when match_audio_length is false)",
    ),
  video_size: z
    .string()
    .optional()
    .default("landscape_4_3")
    .describe("Video size preset or 'auto' to match input image"),
  use_multiscale: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "Generate at smaller scale first for better coherence and details",
    ),
  fps: z
    .number()
    .min(1)
    .max(60)
    .optional()
    .default(25)
    .describe("Frames per second of the generated video"),
  guidance_scale: z
    .number()
    .min(1)
    .max(10)
    .optional()
    .default(3)
    .describe("Guidance scale for generation"),
  num_inference_steps: z
    .number()
    .int()
    .min(8)
    .max(50)
    .optional()
    .default(40)
    .describe("Number of inference steps"),
  acceleration: accelerationSchema
    .optional()
    .default("regular")
    .describe("Acceleration level"),
  camera_lora: cameraLoraSchema
    .optional()
    .default("none")
    .describe("Camera movement LoRA to control camera motion"),
  camera_lora_scale: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .default(1)
    .describe("Scale of the camera LoRA"),
  negative_prompt: z
    .string()
    .optional()
    .describe("What to avoid in generation"),
  seed: z.number().int().optional().describe("Seed for reproducibility"),
  enable_prompt_expansion: z
    .boolean()
    .optional()
    .default(true)
    .describe("Whether to enable prompt expansion for better results"),
  enable_safety_checker: z
    .boolean()
    .optional()
    .default(true)
    .describe("Whether to enable the safety checker"),
  image_strength: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .default(1)
    .describe("Strength of the input image for video generation"),
  end_image_strength: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .default(1)
    .describe("Strength of the end image for video generation"),
  audio_strength: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .default(1)
    .describe(
      "Audio conditioning strength. Below 1.0 allows the model to change the audio",
    ),
  preprocess_audio: z
    .boolean()
    .optional()
    .default(true)
    .describe("Whether to preprocess audio before conditioning"),
  video_output_type: videoOutputTypeSchema
    .optional()
    .default("X264 (.mp4)")
    .describe("Output video format"),
  video_quality: videoQualitySchema
    .optional()
    .default("high")
    .describe("Output video quality"),
});

// Output schema with Zod
const ltxA2vOutputSchema = z.object({
  video: z.object({
    url: z.string(),
    file_name: z.string().optional(),
    content_type: z.string().optional(),
  }),
  seed: z.number().int().describe("The seed used for generation"),
  prompt: z.string().describe("The prompt used for generation"),
});

const schema: ZodSchema<typeof ltxA2vInputSchema, typeof ltxA2vOutputSchema> = {
  input: ltxA2vInputSchema,
  output: ltxA2vOutputSchema,
};

export const definition: ModelDefinition<typeof schema> = {
  type: "model",
  name: "ltx-2-a2v",
  description:
    "LTX-2 19B Audio-to-Video — generate video with audio from audio, text and optional images",
  providers: ["fal"],
  defaultProvider: "fal",
  providerModels: {
    fal: "fal-ai/ltx-2-19b/audio-to-video",
  },
  schema,
  pricing: {
    fal: {
      description:
        "$0.0018 per megapixel of video data (width x height x frames) via fal. E.g. 121 frames at 1280x720 = ~112 MP = $0.20",
      calculate: ({ width = 1024, height = 768, numFrames = 121 }) => {
        const megapixels = (width * height * numFrames) / 1_000_000;
        return Math.ceil(megapixels) * 0.0018;
      },
      minUsd: 0.05, // small video ~28 MP
      maxUsd: 0.8, // 481 frames at 1280x720 ~443 MP
    },
  },
};

export default definition;
