import { defineCommand } from "citty";
import { resolve } from "../../core/registry/resolver.ts";
import { getCliSchemaInfo, toJsonSchema } from "../../core/schema/helpers.ts";
import type {
  ActionDefinition,
  Definition,
  ModelDefinition,
  SkillDefinition,
} from "../../core/schema/types.ts";
import {
  Badge,
  Header,
  OptionRow,
  Separator,
  VargBox,
  VargText,
} from "../ui/index.ts";
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
      <box style={{ flexDirection: "column", paddingLeft: 2, marginBottom: 1 }}>
        {Object.entries(properties).map(([key, prop]) => (
          <OptionRow
            key={key}
            name={key}
            description={prop.description}
            required={required.includes(key)}
            defaultValue={prop.default}
            enumValues={prop.enum}
            type={prop.type}
          />
        ))}
      </box>
    </>
  );
}

function OutputSchemaView({ schema }: { schema: unknown }) {
  // biome-ignore lint/suspicious/noExplicitAny: Zod v4 type compatibility
  const jsonSchema = toJsonSchema(schema as any);
  return (
    <>
      <Header>OUTPUT</Header>
      <box style={{ paddingLeft: 2, marginBottom: 1 }}>
        <text>{jsonSchema.description || "Output result"}</text>
      </box>
    </>
  );
}

function WhichView({ item }: WhichViewProps) {
  return (
    <VargBox title={item.name}>
      <box style={{ marginBottom: 1 }}>
        <text>{item.description}</text>
      </box>

      <Header>TYPE</Header>
      <box style={{ paddingLeft: 2, marginBottom: 1 }}>
        <Badge type={item.type} />
      </box>

      {item.type === "model" && (
        <>
          <Header>PROVIDERS</Header>
          <box
            style={{ flexDirection: "column", paddingLeft: 2, marginBottom: 1 }}
          >
            <text>{(item as ModelDefinition).providers.join(", ")}</text>
            <text fg="gray">
              default: {(item as ModelDefinition).defaultProvider}
            </text>
          </box>
        </>
      )}

      {item.type === "action" &&
        (item as ActionDefinition).routes.length > 0 && (
          <>
            <Header>ROUTES</Header>
            <box
              style={{
                flexDirection: "column",
                paddingLeft: 2,
                marginBottom: 1,
              }}
            >
              {(item as ActionDefinition).routes.map((route) => (
                <box key={route.target}>
                  <text>
                    {"\u2192"} {route.target}
                  </text>
                  {route.when && (
                    <text fg="gray"> when {JSON.stringify(route.when)}</text>
                  )}
                </box>
              ))}
            </box>
          </>
        )}

      {item.type === "skill" && (
        <>
          <Header>STEPS</Header>
          <box
            style={{ flexDirection: "column", paddingLeft: 2, marginBottom: 1 }}
          >
            {(item as SkillDefinition).steps.map((step, index) => (
              <box key={step.name}>
                <text>
                  {index + 1}. {step.name} {"\u2192"} {step.run}
                </text>
              </box>
            ))}
          </box>
        </>
      )}

      <InputSchemaView schema={item.schema.input} />
      <OutputSchemaView schema={item.schema.output} />

      <Separator />
      <box style={{ marginTop: 1 }}>
        <text fg="gray">run with </text>
        <text fg={theme.colors.accent}>varg run {item.name} [options]</text>
      </box>
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
    <box style={{ flexDirection: "column", padding: 1 }}>
      <VargText variant="error">not found: '{name}'</VargText>
      {suggestions && suggestions.length > 0 && (
        <box style={{ marginTop: 1 }}>
          <text>did you mean: {suggestions.slice(0, 3).join(", ")}?</text>
        </box>
      )}
    </box>
  );
}

function WhichHelpView() {
  return (
    <VargBox title="varg which">
      <box style={{ marginBottom: 1 }}>
        <text>inspect a model, action, or skill</text>
      </box>

      <Header>USAGE</Header>
      <box style={{ paddingLeft: 2, marginBottom: 1 }}>
        <VargText variant="accent">varg which {"<name>"} [--json]</VargText>
      </box>

      <Header>ARGUMENTS</Header>
      <box style={{ flexDirection: "column", paddingLeft: 2, marginBottom: 1 }}>
        <text>name name of item to inspect</text>
      </box>

      <Header>OPTIONS</Header>
      <box style={{ flexDirection: "column", paddingLeft: 2, marginBottom: 1 }}>
        <text>--json output as json</text>
      </box>

      <Header>EXAMPLES</Header>
      <box style={{ flexDirection: "column", paddingLeft: 2 }}>
        <box style={{ flexDirection: "column", marginBottom: 1 }}>
          <text fg="gray"># inspect video action</text>
          <VargText variant="accent">varg which video</VargText>
        </box>
        <box style={{ flexDirection: "column" }}>
          <text fg="gray"># get json schema</text>
          <VargText variant="accent">varg which flux --json</VargText>
        </box>
      </box>
    </VargBox>
  );
}

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
