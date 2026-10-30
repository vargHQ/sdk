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
    {
      command: "vargai init",
      description: "sign in and install the agent skill",
    },
    {
      command: 'vargai mcp generate_video --prompt "waves at dusk"',
      description: "make a video",
    },
    { command: "vargai run image --prompt 'a fox'", description: "one model" },
  ];

  return (
    <VargBox title="vargai">
      <Box marginBottom={1}>
        <Text>ai video generation sdk.</Text>
      </Box>

      <Header>COMMANDS</Header>
      <Box flexDirection="column" marginY={1}>
        <CommandRow
          name="init"
          description="sign in, install the agent skill"
        />
        <CommandRow name="run" description="run a single model or action" />
        <CommandRow
          name="list"
          description="discover models, actions, skills"
        />
      </Box>

      <Header>VARG MCP</Header>
      <Box flexDirection="column" marginY={1}>
        <CommandRow
          name="search"
          description="find skills and how-to guides (no key needed)"
        />
        <CommandRow
          name="install"
          description="install a skill into your agent (no key needed)"
        />
        <CommandRow
          name="tools"
          description="every varg MCP tool; ○ = no key needed"
        />
        <CommandRow
          name="mcp <tool>"
          description="run any MCP tool: vargai mcp generate_image 'a fox'"
        />
        <CommandRow name="whoami" description="account, team, balance" />
        <CommandRow
          name="version"
          description="vargai, the varg MCP CLI, latest on npm"
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
