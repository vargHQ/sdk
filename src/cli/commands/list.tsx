/**
 * varg list command
 * Ink-based discovery view
 */

import { defineCommand } from "citty";
import { Box, Text } from "ink";
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
      {/* Models section */}
      {(!filterType || filterType === "model") && (
        <Box flexDirection="column" marginBottom={1}>
          <Header>MODELS</Header>
          <Box marginY={1}>
            {models.length > 0 ? (
              <DataTable
                rows={models.map((m) => ({
                  name: m.name,
                  description: m.description,
                  type: m.type as "model",
                }))}
              />
            ) : (
              <Box paddingLeft={2}>
                <VargText variant="muted">no models registered</VargText>
              </Box>
            )}
          </Box>
        </Box>
      )}

      {/* Actions section */}
      {(!filterType || filterType === "action") && (
        <Box flexDirection="column" marginBottom={1}>
          <Header>ACTIONS</Header>
          <Box marginY={1}>
            {actions.length > 0 ? (
              <DataTable
                rows={actions.map((a) => ({
                  name: a.name,
                  description: a.description,
                  type: a.type as "action",
                }))}
              />
            ) : (
              <Box paddingLeft={2}>
                <VargText variant="muted">no actions registered</VargText>
              </Box>
            )}
          </Box>
        </Box>
      )}

      {/* Skills section */}
      {(!filterType || filterType === "skill") && (
        <Box flexDirection="column" marginBottom={1}>
          <Header>SKILLS</Header>
          <Box marginY={1}>
            {skills.length > 0 ? (
              <DataTable
                rows={skills.map((s) => ({
                  name: s.name,
                  description: s.description,
                  type: s.type as "skill",
                }))}
              />
            ) : (
              <Box paddingLeft={2}>
                <VargText variant="muted">no skills registered</VargText>
              </Box>
            )}
          </Box>
        </Box>
      )}

      {/* Footer */}
      <Separator />
      <Box marginTop={1}>
        <Text>
          {stats.models} models · {stats.actions} actions · {stats.skills}{" "}
          skills
        </Text>
      </Box>
      <Box marginTop={1}>
        <VargText variant="muted">run </VargText>
        <VargText variant="accent">varg which {"<name>"}</VargText>
        <VargText variant="muted"> for details</VargText>
      </Box>
    </VargBox>
  );
}

/**
 * Convert a definition to an AI agent tool schema
 */
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

/**
 * Generate all tools as JSON schemas for AI agents
 */
function generateToolsSchema(filterType?: "model" | "action" | "skill") {
  const definitions = registry.list(filterType);

  return {
    tools: definitions.map(definitionToToolSchema),
  };
}

/** Help view for list command */
function ListHelpView() {
  return (
    <VargBox title="varg list">
      <Box marginBottom={1}>
        <Text>discover what's available</Text>
      </Box>

      <Header>USAGE</Header>
      <Box paddingLeft={2} marginBottom={1}>
        <VargText variant="accent">varg list [type] [options]</VargText>
      </Box>

      <Header>ARGUMENTS</Header>
      <Box flexDirection="column" paddingLeft={2} marginBottom={1}>
        <Text>type filter by type: model, action, skill</Text>
      </Box>

      <Header>OPTIONS</Header>
      <Box flexDirection="column" paddingLeft={2} marginBottom={1}>
        <OptionRow
          name="schema"
          description="output all tools as JSON schemas for AI agents"
        />
        <OptionRow name="help, -h" description="show this help" />
      </Box>

      <Header>EXAMPLES</Header>
      <Box flexDirection="column" paddingLeft={2}>
        <Box flexDirection="column" marginBottom={1}>
          <Text dimColor># list everything</Text>
          <VargText variant="accent">varg list</VargText>
        </Box>
        <Box flexDirection="column" marginBottom={1}>
          <Text dimColor># list only models</Text>
          <VargText variant="accent">varg list model</VargText>
        </Box>
        <Box flexDirection="column" marginBottom={1}>
          <Text dimColor># list only actions</Text>
          <VargText variant="accent">varg list action</VargText>
        </Box>
        <Box flexDirection="column">
          <Text dimColor># export tools for AI agent</Text>
          <VargText variant="accent">varg list --schema</VargText>
        </Box>
      </Box>
    </VargBox>
  );
}

/** Show list command help */
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
    // Handle --help
    if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
      showListHelp();
      return;
    }

    const filterType = args.type as "model" | "action" | "skill" | undefined;

    // Output JSON schemas for AI agents
    if (args.schema) {
      const toolsSchema = generateToolsSchema(filterType);
      console.log(JSON.stringify(toolsSchema, null, 2));
      return;
    }

    renderStatic(<ListView filterType={filterType} />);
  },
});
