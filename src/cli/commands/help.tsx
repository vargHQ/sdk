import { defineCommand } from "citty";
import { Header, HelpBlock, VargBox, VargText } from "../ui/index.ts";
import { renderStatic } from "../ui/render.ts";

interface CommandRowProps {
  name: string;
  description: string;
}

function CommandRow({ name, description }: CommandRowProps) {
  return (
    <box style={{ paddingLeft: 2 }}>
      <VargText variant="accent">{name.padEnd(12)}</VargText>
      <text>{description}</text>
    </box>
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
      <box style={{ marginBottom: 1 }}>
        <text>ai video infrastructure from your terminal</text>
      </box>

      <Header>COMMANDS</Header>
      <box style={{ flexDirection: "column", marginTop: 1, marginBottom: 1 }}>
        <CommandRow name="run" description="run a model, action, or skill" />
        <CommandRow name="list" description="discover what's available" />
        <CommandRow
          name="find"
          description="search for models, actions, skills"
        />
        <CommandRow name="which" description="inspect a specific item" />
        <CommandRow name="help" description="show this help" />
      </box>

      <Header>EXAMPLES</Header>
      <box style={{ marginTop: 1 }}>
        <HelpBlock examples={examples} />
      </box>
    </VargBox>
  );
}

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
