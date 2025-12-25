/**
 * varg list command
 * Ink-based discovery view
 */

import { defineCommand } from "citty";
import { Box, Text } from "ink";
import { registry } from "../../core/registry/index.ts";
import {
  DataTable,
  Header,
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

/** Help view for list command */
function ListHelpView() {
  return (
    <VargBox title="varg list">
      <Box marginBottom={1}>
        <Text>discover what's available</Text>
      </Box>

      <Header>USAGE</Header>
      <Box paddingLeft={2} marginBottom={1}>
        <VargText variant="accent">varg list [type]</VargText>
      </Box>

      <Header>ARGUMENTS</Header>
      <Box flexDirection="column" paddingLeft={2} marginBottom={1}>
        <Text>type filter by type: model, action, skill</Text>
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
        <Box flexDirection="column">
          <Text dimColor># list only actions</Text>
          <VargText variant="accent">varg list action</VargText>
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
  },
  async run({ args, rawArgs }) {
    // Handle --help
    if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
      showListHelp();
      return;
    }

    const filterType = args.type as "model" | "action" | "skill" | undefined;
    renderStatic(<ListView filterType={filterType} />);
  },
});
