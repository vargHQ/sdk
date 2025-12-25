/**
 * varg help command
 * Ink-based help display
 */

import { defineCommand } from "citty";
import { Box, Text } from "ink";
import { Header, VargBox } from "../ui/index.ts";
import { renderStatic } from "../ui/render.ts";
import { theme } from "../ui/theme.ts";

interface CommandRowProps {
  name: string;
  description: string;
}

function CommandRow({ name, description }: CommandRowProps) {
  return (
    <Box paddingLeft={2}>
      <Text color={theme.colors.accent}>{name.padEnd(12)}</Text>
      <Text>{description}</Text>
    </Box>
  );
}

interface ExampleBlockProps {
  comment: string;
  command: string;
}

function ExampleBlock({ comment, command }: ExampleBlockProps) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box paddingLeft={2}>
        <Text dimColor># {comment}</Text>
      </Box>
      <Box paddingLeft={2}>
        <Text>{command}</Text>
      </Box>
    </Box>
  );
}

function HelpView() {
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
      <Box flexDirection="column" marginTop={1}>
        <ExampleBlock
          comment="generate a video from text"
          command='varg run video --prompt "ocean waves"'
        />
        <ExampleBlock
          comment="generate video from image"
          command='varg run video --prompt "person talking" --image photo.jpg'
        />
        <ExampleBlock
          comment="text to speech"
          command='varg run voice --text "hello world" --voice sam'
        />
        <ExampleBlock comment="see all available actions" command="varg list" />
        <ExampleBlock
          comment="get detailed info about an action"
          command="varg run video --info"
        />
      </Box>
    </VargBox>
  );
}

export const helpCmd = defineCommand({
  meta: {
    name: "help",
    description: "show help",
  },
  async run() {
    renderStatic(<HelpView />);
  },
});
