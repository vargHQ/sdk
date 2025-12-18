/**
 * varg list command
 * Ink-based discovery view
 */

import { defineCommand } from "citty";
import { Box, Text } from "ink";
import { registry } from "../../core/registry/index.ts";
import { DataTable, Header, Separator, VargBox } from "../ui/index.ts";
import { renderStatic } from "../ui/render.ts";
import { theme } from "../ui/theme.ts";

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
                <Text dimColor>no models registered</Text>
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
                <Text dimColor>no actions registered</Text>
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
                <Text dimColor>no skills registered</Text>
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
        <Text dimColor>run </Text>
        <Text color={theme.colors.accent}>varg run {"<name>"} --info</Text>
        <Text dimColor> for details</Text>
      </Box>
    </VargBox>
  );
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
  async run({ args }) {
    const filterType = args.type as "model" | "action" | "skill" | undefined;
    renderStatic(<ListView filterType={filterType} />);
  },
});
