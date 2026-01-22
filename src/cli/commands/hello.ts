import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { defineCommand } from "citty";

const HELLO_TEMPLATE = `/** @jsxImportSource vargai */
import { Render, Clip, Image, Video, assets } from "vargai/react";
import { fal } from "vargai/ai";

const girl = Image({
  prompt: {
    text: \`Using the attached reference images, generate a photorealistic three-quarter editorial portrait of the exact same character — maintain identical face, hairstyle, and proportions from Image 1.

Framing: Head and shoulders, cropped at upper chest. Direct eye contact with camera.

Natural confident expression, relaxed shoulders.
Preserve the outfit neckline and visible clothing details from reference.

Background: Deep black with two contrasting orange gradient accents matching Reference 2. Soft gradient bleed, no hard edges.

Shot on 85mm f/1.4 lens, shallow depth of field. Clean studio lighting — soft key light on face, subtle rim light on hair and shoulders for separation. High-end fashion editorial aesthetic.\`,
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
`;

export const helloCmd = defineCommand({
  meta: {
    name: "hello",
    description: "create hello.tsx starter video",
  },
  args: {
    directory: {
      type: "positional",
      description: "directory (default: current)",
      required: false,
    },
  },
  async run({ args }) {
    const dir = (args.directory as string) || ".";
    const cwd = dir === "." ? process.cwd() : join(process.cwd(), dir);

    if (!existsSync(cwd) && dir !== ".") {
      mkdirSync(cwd, { recursive: true });
      console.log(`created ${dir}/`);
    }

    const outputDir = join(cwd, "output");
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
      console.log(`created output/`);
    }

    const cacheDir = join(cwd, ".cache/ai");
    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true });
      console.log(`created .cache/ai/`);
    }

    const helloPath = join(cwd, "hello.tsx");
    if (existsSync(helloPath)) {
      console.log(`hello.tsx already exists, skipping`);
    } else {
      writeFileSync(helloPath, HELLO_TEMPLATE);
      console.log(`created hello.tsx`);
    }

    console.log(`\ndone! run: bunx vargai render hello.tsx`);
  },
});
