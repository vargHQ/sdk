/**
 * varg which command
 * Ink-based inspection view
 */

import { defineCommand } from "citty";
import { Box, Text } from "ink";
import { resolve } from "../../core/registry/resolver.ts";
import type {
  ActionDefinition,
  Definition,
  ModelDefinition,
  SkillDefinition,
} from "../../core/schema/types.ts";
import { Header, Separator, VargBox } from "../ui/index.ts";
import { renderStatic } from "../ui/render.ts";
import { theme } from "../ui/theme.ts";

interface WhichViewProps {
  item: Definition;
}

function WhichView({ item }: WhichViewProps) {
  return (
    <VargBox title={item.name}>
      <Box marginBottom={1}>
        <Text>{item.description}</Text>
      </Box>

      <Header>TYPE</Header>
      <Box paddingLeft={2} marginBottom={1}>
        <Text>{item.type}</Text>
      </Box>

      {/* Providers for models */}
      {item.type === "model" && (
        <>
          <Header>PROVIDERS</Header>
          <Box flexDirection="column" paddingLeft={2} marginBottom={1}>
            <Text>{(item as ModelDefinition).providers.join(", ")}</Text>
            <Text dimColor>
              default: {(item as ModelDefinition).defaultProvider}
            </Text>
          </Box>
        </>
      )}

      {/* Routes for actions */}
      {item.type === "action" &&
        (item as ActionDefinition).routes.length > 0 && (
          <>
            <Header>ROUTES</Header>
            <Box flexDirection="column" paddingLeft={2} marginBottom={1}>
              {(item as ActionDefinition).routes.map((route) => (
                <Box key={route.target}>
                  <Text>
                    {"\u2192"} {route.target}
                  </Text>
                  {route.when && (
                    <Text dimColor> when {JSON.stringify(route.when)}</Text>
                  )}
                </Box>
              ))}
            </Box>
          </>
        )}

      {/* Steps for skills */}
      {item.type === "skill" && (
        <>
          <Header>STEPS</Header>
          <Box flexDirection="column" paddingLeft={2} marginBottom={1}>
            {(item as SkillDefinition).steps.map((step, index) => (
              <Box key={step.name}>
                <Text>
                  {index + 1}. {step.name} {"\u2192"} {step.run}
                </Text>
              </Box>
            ))}
          </Box>
        </>
      )}

      {/* Input schema */}
      <Header>INPUT SCHEMA</Header>
      <Box flexDirection="column" paddingLeft={2} marginBottom={1}>
        {Object.entries(item.schema.input.properties).map(([key, prop]) => {
          const isRequired = item.schema.input.required.includes(key);
          return (
            <Box key={key}>
              <Text color={isRequired ? theme.colors.warning : undefined}>
                {isRequired ? "*" : " "}
              </Text>
              <Text> {key.padEnd(15)}</Text>
              <Text dimColor>
                {"<"}
                {prop.type}
                {">"}
              </Text>
              <Text> {prop.description}</Text>
            </Box>
          );
        })}
      </Box>

      {/* Output */}
      <Header>OUTPUT</Header>
      <Box paddingLeft={2} marginBottom={1}>
        <Text>{item.schema.output.description}</Text>
      </Box>

      <Separator />
      <Box marginTop={1}>
        <Text dimColor>run with </Text>
        <Text color={theme.colors.accent}>varg run {item.name} [options]</Text>
      </Box>
    </VargBox>
  );
}

function NotFoundView({
  name,
  suggestions,
}: {
  name: string;
  suggestions?: string[];
}) {
  return (
    <Box flexDirection="column" padding={1}>
      <Text color={theme.colors.error}>not found: '{name}'</Text>
      {suggestions && suggestions.length > 0 && (
        <Box marginTop={1}>
          <Text>did you mean: {suggestions.slice(0, 3).join(", ")}?</Text>
        </Box>
      )}
    </Box>
  );
}

export const whichCmd = defineCommand({
  meta: {
    name: "which",
    description: "inspect a model, action, or skill",
  },
  args: {
    name: {
      type: "positional",
      description: "name to inspect",
      required: true,
    },
    json: {
      type: "boolean",
      description: "output as json",
    },
  },
  async run({ args }) {
    const name = args.name as string;
    const result = resolve(name, { fuzzy: true });

    if (!result.definition) {
      renderStatic(
        <NotFoundView name={name} suggestions={result.suggestions} />,
      );
      process.exit(1);
    }

    const item = result.definition;

    if (args.json) {
      console.log(JSON.stringify(item, null, 2));
      return;
    }

    renderStatic(<WhichView item={item} />);
  },
});
