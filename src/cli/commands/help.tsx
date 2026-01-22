/** @jsxImportSource react */

import { defineCommand } from "citty";
import { Box, Text } from "ink";
import { Header, HelpBlock, VargBox, VargText } from "../ui/index.ts";
import { renderStatic } from "../ui/render.ts";

interface CommandRowProps {
  name: string;
  description: string;
}

function CommandRow({ name, description }: CommandRowProps) {
  return (
    <Box paddingLeft={2}>
      <VargText variant="accent">{name.padEnd(12)}</VargText>
      <Text>{description}</Text>
    </Box>
  );
}

function HelpView() {
  const examples = [
    { command: "vargai hello", description: "create hello.tsx starter" },
    { command: "vargai render hello.tsx", description: "render jsx to video" },
    { command: "vargai init", description: "full setup with api keys" },
  ];

  return (
    <VargBox title="vargai">
      <Box marginBottom={1}>
        <Text>ai video generation sdk. jsx for videos.</Text>
      </Box>

      <Header>COMMANDS</Header>
      <Box flexDirection="column" marginY={1}>
        <CommandRow name="hello" description="create hello.tsx starter video" />
        <CommandRow name="render" description="render jsx component to video" />
        <CommandRow name="preview" description="fast preview (placeholders)" />
        <CommandRow name="init" description="full setup with api keys" />
        <CommandRow
          name="studio"
          description="visual editor at localhost:8282"
        />
        <CommandRow name="run" description="run a single model or action" />
        <CommandRow
          name="list"
          description="discover models, actions, skills"
        />
      </Box>

      <Header>QUICKSTART</Header>
      <Box marginTop={1}>
        <HelpBlock examples={examples} />
      </Box>
    </VargBox>
  );
}

/** Render help view - can be called directly */
export function showHelp() {
  renderStatic(<HelpView />);
}

export const helpCmd = defineCommand({
  meta: {
    name: "help",
    description: "show help",
  },
  async run() {
    showHelp();
  },
});
