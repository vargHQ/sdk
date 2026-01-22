import { defineCommand } from "citty";
import { registry } from "../../core/registry/index.ts";
import { toJsonSchema } from "../../core/schema/helpers.ts";
import type { Definition } from "../../core/schema/types.ts";
import {
  DataTable,
  Header,
  OptionRow,
  Separator,
  VargBox,
  VargText,
} from "../ui/index.ts";
import { renderStatic } from "../ui/render.ts";

interface ListViewProps {
  filterType?: "model" | "action" | "skill";
}

function ListView({ filterType }: ListViewProps) {
  const definitions = registry.list(filterType);

  const models = definitions.filter((d) => d.type === "model");
  const actions = definitions.filter((d) => d.type === "action");
  const skills = definitions.filter((d) => d.type === "skill");
  const stats = registry.stats;

  return (
    <VargBox title="varg">
      {(!filterType || filterType === "model") && (
        <box style={{ flexDirection: "column", marginBottom: 1 }}>
          <Header>MODELS</Header>
          <box style={{ marginTop: 1, marginBottom: 1 }}>
            {models.length > 0 ? (
              <DataTable
                rows={models.map((m) => ({
                  name: m.name,
                  description: m.description,
                  type: m.type as "model",
                }))}
              />
            ) : (
              <box style={{ paddingLeft: 2 }}>
                <VargText variant="muted">no models registered</VargText>
              </box>
            )}
          </box>
        </box>
      )}

      {(!filterType || filterType === "action") && (
        <box style={{ flexDirection: "column", marginBottom: 1 }}>
          <Header>ACTIONS</Header>
          <box style={{ marginTop: 1, marginBottom: 1 }}>
            {actions.length > 0 ? (
              <DataTable
                rows={actions.map((a) => ({
                  name: a.name,
                  description: a.description,
                  type: a.type as "action",
                }))}
              />
            ) : (
              <box style={{ paddingLeft: 2 }}>
                <VargText variant="muted">no actions registered</VargText>
              </box>
            )}
          </box>
        </box>
      )}

      {(!filterType || filterType === "skill") && (
        <box style={{ flexDirection: "column", marginBottom: 1 }}>
          <Header>SKILLS</Header>
          <box style={{ marginTop: 1, marginBottom: 1 }}>
            {skills.length > 0 ? (
              <DataTable
                rows={skills.map((s) => ({
                  name: s.name,
                  description: s.description,
                  type: s.type as "skill",
                }))}
              />
            ) : (
              <box style={{ paddingLeft: 2 }}>
                <VargText variant="muted">no skills registered</VargText>
              </box>
            )}
          </box>
        </box>
      )}

      <Separator />
      <box style={{ marginTop: 1 }}>
        <text>
          {stats.models} models · {stats.actions} actions · {stats.skills}{" "}
          skills
        </text>
      </box>
      <box style={{ marginTop: 1 }}>
        <VargText variant="muted">run </VargText>
        <VargText variant="accent">varg which {"<name>"}</VargText>
        <VargText variant="muted"> for details</VargText>
      </box>
    </VargBox>
  );
}

function definitionToToolSchema(def: Definition) {
  const inputSchema = toJsonSchema(def.schema.input);

  return {
    type: "function" as const,
    function: {
      name: def.name,
      description: def.description,
      parameters: {
        type: "object",
        properties: inputSchema.properties || {},
        required: inputSchema.required || [],
      },
    },
  };
}

function generateToolsSchema(filterType?: "model" | "action" | "skill") {
  const definitions = registry.list(filterType);

  return {
    tools: definitions.map(definitionToToolSchema),
  };
}

function ListHelpView() {
  return (
    <VargBox title="varg list">
      <box style={{ marginBottom: 1 }}>
        <text>discover what's available</text>
      </box>

      <Header>USAGE</Header>
      <box style={{ paddingLeft: 2, marginBottom: 1 }}>
        <VargText variant="accent">varg list [type] [options]</VargText>
      </box>

      <Header>ARGUMENTS</Header>
      <box style={{ flexDirection: "column", paddingLeft: 2, marginBottom: 1 }}>
        <text>type filter by type: model, action, skill</text>
      </box>

      <Header>OPTIONS</Header>
      <box style={{ flexDirection: "column", paddingLeft: 2, marginBottom: 1 }}>
        <OptionRow
          name="schema"
          description="output all tools as JSON schemas for AI agents"
        />
        <OptionRow name="help, -h" description="show this help" />
      </box>

      <Header>EXAMPLES</Header>
      <box style={{ flexDirection: "column", paddingLeft: 2 }}>
        <box style={{ flexDirection: "column", marginBottom: 1 }}>
          <text fg="gray"># list everything</text>
          <VargText variant="accent">varg list</VargText>
        </box>
        <box style={{ flexDirection: "column", marginBottom: 1 }}>
          <text fg="gray"># list only models</text>
          <VargText variant="accent">varg list model</VargText>
        </box>
        <box style={{ flexDirection: "column", marginBottom: 1 }}>
          <text fg="gray"># list only actions</text>
          <VargText variant="accent">varg list action</VargText>
        </box>
        <box style={{ flexDirection: "column" }}>
          <text fg="gray"># export tools for AI agent</text>
          <VargText variant="accent">varg list --schema</VargText>
        </box>
      </box>
    </VargBox>
  );
}

export function showListHelp() {
  renderStatic(<ListHelpView />);
}

export const listCmd = defineCommand({
  meta: {
    name: "list",
    description: "discover what's available",
  },
  args: {
    type: {
      type: "positional",
      description: "filter by type (model, action, skill)",
      required: false,
    },
    schema: {
      type: "boolean",
      description: "output all tools as JSON schemas for AI agents",
    },
  },
  async run({ args, rawArgs }) {
    if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
      showListHelp();
      return;
    }

    const filterType = args.type as "model" | "action" | "skill" | undefined;

    if (args.schema) {
      const toolsSchema = generateToolsSchema(filterType);
      console.log(JSON.stringify(toolsSchema, null, 2));
      return;
    }

    renderStatic(<ListView filterType={filterType} />);
  },
});
