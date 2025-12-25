/**
 * varg which command
 * Ink-based inspection view
 */

import { defineCommand } from "citty";
import { Box, Text } from "ink";
import { resolve } from "../../core/registry/resolver.ts";
import { getCliSchemaInfo, toJsonSchema } from "../../core/schema/helpers.ts";
import type {
  ActionDefinition,
  Definition,
  ModelDefinition,
  SkillDefinition,
} from "../../core/schema/types.ts";
import { Badge, Header, Separator, VargBox, VargText } from "../ui/index.ts";
import { renderStatic } from "../ui/render.ts";
import { theme } from "../ui/theme.ts";

interface WhichViewProps {
  item: Definition;
}

function InputSchemaView({ schema }: { schema: unknown }) {
  // biome-ignore lint/suspicious/noExplicitAny: Zod v4 type compatibility
  const { properties, required } = getCliSchemaInfo(schema as any);
  return (
    <>
      <Header>INPUT SCHEMA</Header>
      <Box flexDirection="column" paddingLeft={2} marginBottom={1}>
        {Object.entries(properties).map(([key, prop]) => {
          const isRequired = required.includes(key);
          return (
            <Box key={key}>
              <Text color={isRequired ? theme.colors.warning : undefined}>
                {isRequired ? "*" : " "}
              </Text>
              <Text> {key.padEnd(15)}</Text>
              <Text dimColor>
                {"<"}
                {prop.type || "any"}
                {">"}
              </Text>
              <Text> {prop.description || ""}</Text>
            </Box>
          );
        })}
      </Box>
    </>
  );
}

function OutputSchemaView({ schema }: { schema: unknown }) {
  // biome-ignore lint/suspicious/noExplicitAny: Zod v4 type compatibility
  const jsonSchema = toJsonSchema(schema as any);
  return (
    <>
      <Header>OUTPUT</Header>
      <Box paddingLeft={2} marginBottom={1}>
        <Text>{jsonSchema.description || "Output result"}</Text>
      </Box>
    </>
  );
}

function WhichView({ item }: WhichViewProps) {
  return (
    <VargBox title={item.name}>
      <Box marginBottom={1}>
        <Text>{item.description}</Text>
      </Box>

      <Header>TYPE</Header>
      <Box paddingLeft={2} marginBottom={1}>
        <Badge type={item.type} />
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
      <InputSchemaView schema={item.schema.input} />

      {/* Output */}
      <OutputSchemaView schema={item.schema.output} />

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
      <VargText variant="error">not found: '{name}'</VargText>
      {suggestions && suggestions.length > 0 && (
        <Box marginTop={1}>
          <Text>did you mean: {suggestions.slice(0, 3).join(", ")}?</Text>
        </Box>
      )}
    </Box>
  );
}

/** Help view for which command */
function WhichHelpView() {
  return (
    <VargBox title="varg which">
      <Box marginBottom={1}>
        <Text>inspect a model, action, or skill</Text>
      </Box>

      <Header>USAGE</Header>
      <Box paddingLeft={2} marginBottom={1}>
        <VargText variant="accent">varg which {"<name>"} [--json]</VargText>
      </Box>

      <Header>ARGUMENTS</Header>
      <Box flexDirection="column" paddingLeft={2} marginBottom={1}>
        <Text>name name of item to inspect</Text>
      </Box>

      <Header>OPTIONS</Header>
      <Box flexDirection="column" paddingLeft={2} marginBottom={1}>
        <Text>--json output as json</Text>
      </Box>

      <Header>EXAMPLES</Header>
      <Box flexDirection="column" paddingLeft={2}>
        <Box flexDirection="column" marginBottom={1}>
          <Text dimColor># inspect video action</Text>
          <VargText variant="accent">varg which video</VargText>
        </Box>
        <Box flexDirection="column">
          <Text dimColor># get json schema</Text>
          <VargText variant="accent">varg which flux --json</VargText>
        </Box>
      </Box>
    </VargBox>
  );
}

/** Show which command help */
export function showWhichHelp() {
  renderStatic(<WhichHelpView />);
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
      required: false,
    },
    json: {
      type: "boolean",
      description: "output as json",
    },
  },
  async run({ args, rawArgs }) {
    // Handle --help
    if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
      showWhichHelp();
      return;
    }

    const name = args.name as string;

    if (!name) {
      showWhichHelp();
      return;
    }

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
