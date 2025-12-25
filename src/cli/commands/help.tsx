/**
 * varg help command
 * Ink-based help display
 */

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
    {
      command: 'varg run video --prompt "ocean waves"',
      description: "generate a video from text",
    },
    {
      command: 'varg run video --prompt "person talking" --image photo.jpg',
      description: "generate video from image",
    },
    {
      command: 'varg run voice --text "hello world" --voice sam',
      description: "text to speech",
    },
    { command: "varg list", description: "see all available" },
    {
      command: "varg which video",
      description: "inspect an action or model",
    },
  ];

  return (
    <VargBox title="varg">
      <Box marginBottom={1}>
        <Text>ai video infrastructure from your terminal</Text>
      </Box>

      <Header>COMMANDS</Header>
      <Box flexDirection="column" marginY={1}>
        <CommandRow name="run" description="run a model, action, or skill" />
        <CommandRow name="list" description="discover what's available" />
        <CommandRow
          name="find"
          description="search for models, actions, skills"
        />
        <CommandRow name="which" description="inspect a specific item" />
        <CommandRow name="help" description="show this help" />
      </Box>

      <Header>EXAMPLES</Header>
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
