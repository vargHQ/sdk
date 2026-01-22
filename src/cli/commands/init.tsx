/** @jsxImportSource react */

import { existsSync, mkdirSync } from "node:fs";
import { defineCommand } from "citty";
import { Box, Text } from "ink";
import { Header, HelpBlock, VargBox, VargText } from "../ui/index.ts";
import { renderStatic } from "../ui/render.ts";

const HELLO_TEMPLATE = `import { Render, Clip, Image, Video, assets } from "vargai/react";
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

function InitHelpView() {
  const examples = [
    { command: "varg init", description: "create hello.tsx in current dir" },
    { command: "varg init my-project", description: "create in my-project/" },
  ];

  return (
    <VargBox title="varg init">
      <Box marginBottom={1}>
        <Text>initialize a new varg project with hello.tsx template.</Text>
      </Box>

      <Header>USAGE</Header>
      <Box paddingLeft={2} marginBottom={1}>
        <VargText variant="accent">varg init [directory]</VargText>
      </Box>

      <Header>EXAMPLES</Header>
      <Box marginTop={1}>
        <HelpBlock examples={examples} />
      </Box>
    </VargBox>
  );
}

export function showInitHelp() {
  renderStatic(<InitHelpView />);
}

export const initCmd = defineCommand({
  meta: {
    name: "init",
    description: "initialize project with hello.tsx",
  },
  args: {
    directory: {
      type: "positional",
      description: "project directory (default: current)",
      required: false,
    },
  },
  async run({ args }) {
    const dir = (args.directory as string) || ".";
    const outputDir = `${dir}/output`;
    const cacheDir = `${dir}/.cache/ai`;
    const helloPath = `${dir}/hello.tsx`;

    if (!existsSync(dir) && dir !== ".") {
      mkdirSync(dir, { recursive: true });
      console.log(`created ${dir}/`);
    }

    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
      console.log(`created ${outputDir}/`);
    }

    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true });
      console.log(`created ${cacheDir}/`);
    }

    if (existsSync(helloPath)) {
      console.log(`hello.tsx already exists, skipping`);
    } else {
      await Bun.write(helloPath, HELLO_TEMPLATE);
      console.log(`created ${helloPath}`);
    }

    console.log(`\ndone! run: varg render hello.tsx`);
  },
});
