/** @jsxImportSource react */

import { existsSync, mkdirSync } from "node:fs";
import { defineCommand } from "citty";
import { Box, Text } from "ink";
import { Header, HelpBlock, VargBox, VargText } from "../ui/index.ts";
import { renderStatic } from "../ui/render.ts";

const HELLO_TEMPLATE = `import { render, Render, Clip, Image, Video, Speech, Music, Captions } from "vargai/react";
import { fal, elevenlabs } from "vargai/ai";

const girl = Image({
  prompt: "young woman, short dark brown bob with wispy bangs, oval face, fair skin, large dark brown eyes, full lips, silver hoop earrings. deep black background, dramatic orange rim lighting, noir premium aesthetic. 85mm portrait, shallow depth of field",
  model: fal.imageModel("flux-schnell"),
  aspectRatio: "9:16",
});

const voiceover = Speech({
  model: elevenlabs.speechModel("eleven_multilingual_v2"),
  voice: "rachel",
  children: "Hey! Welcome to varg. Let's make some videos together!",
});

await render(
  <Render width={1080} height={1920}>
    <Music prompt="upbeat electronic pop, energetic, modern" model={elevenlabs.musicModel()} volume={0.15} />

    <Clip duration={4}>
      <Video
        prompt={{
          text: "woman waves hello enthusiastically, warm smile, friendly expression, studio lighting",
          images: [girl],
        }}
        model={fal.videoModel("kling-v2.5")}
      />
    </Clip>

    <Captions src={voiceover} style="tiktok" color="#ffffff" />
  </Render>,
  { output: "output/hello.mp4" }
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
