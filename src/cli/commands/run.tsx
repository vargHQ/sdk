/**
 * varg run command
 * Ink-based execution with live status updates
 */

import { existsSync } from "node:fs";
import { defineCommand } from "citty";
import { Box, Text } from "ink";
import { executor } from "../../core/executor/index.ts";
import { resolve } from "../../core/registry/resolver.ts";
import { getCliSchemaInfo, toJsonSchema } from "../../core/schema/helpers.ts";
import type { Definition } from "../../core/schema/types.ts";
import { Header, StatusBox, VargBox } from "../ui/index.ts";
import { renderLive, renderStatic } from "../ui/render.ts";
import { theme } from "../ui/theme.ts";

interface RunOptions {
  [key: string]: string | boolean | undefined;
  info?: boolean;
  schema?: boolean;
  json?: boolean;
  quiet?: boolean;
  provider?: string;
}

function parseArgs(args: string[]): { target: string; options: RunOptions } {
  const options: RunOptions = {};
  let target = "";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      if (["info", "schema", "json", "quiet"].includes(key)) {
        options[key] = true;
      } else {
        const value = args[++i];
        if (value) options[key] = value;
      }
    } else if (!target) {
      target = arg;
    } else {
      // Positional args - check if it looks like a file
      if (existsSync(arg) || arg.startsWith("./") || arg.startsWith("/")) {
        if (!options.image && !options.audio) {
          options.image = arg;
        }
      } else if (!options.prompt && !options.text) {
        options.prompt = arg;
      }
    }
  }

  return { target, options };
}

interface HelpViewProps {
  item: Definition;
}

function HelpView({ item }: HelpViewProps) {
  const { properties, required } = getCliSchemaInfo(item.schema.input);
  const reqArgs = required.map((r) => `--${r} <${r}>`).join(" ");

  return (
    <VargBox title={`${item.type}: ${item.name}`}>
      <Box marginBottom={1}>
        <Text>{item.description}</Text>
      </Box>

      <Header>USAGE</Header>
      <Box paddingLeft={2} marginBottom={1}>
        <Text color={theme.colors.accent}>
          varg run {item.name} {reqArgs} [options]
        </Text>
      </Box>

      <Header>OPTIONS</Header>
      <Box flexDirection="column" paddingLeft={2} marginBottom={1}>
        {Object.entries(properties).map(([key, prop]) => {
          const isRequired = required.includes(key);
          const defaultVal =
            prop.default !== undefined ? ` default: ${prop.default}` : "";
          const enumVals = prop.enum ? ` [${prop.enum.join(", ")}]` : "";
          return (
            <Box key={key}>
              <Text>--{key.padEnd(12)}</Text>
              <Text>{prop.description}</Text>
              {isRequired && (
                <Text color={theme.colors.warning}> (required)</Text>
              )}
              {defaultVal && <Text dimColor>{defaultVal}</Text>}
              {enumVals && <Text dimColor>{enumVals}</Text>}
            </Box>
          );
        })}
      </Box>

      {item.type === "model" && (
        <Box flexDirection="column" paddingLeft={2} marginBottom={1}>
          <Text>--provider override default provider</Text>
          <Text dimColor> available: {item.providers.join(", ")}</Text>
        </Box>
      )}

      <Box flexDirection="column" paddingLeft={2}>
        <Text>--json output result as json</Text>
        <Text>--quiet minimal output</Text>
        <Text>--info show this help</Text>
      </Box>
    </VargBox>
  );
}

function ErrorView({ message, hint }: { message: string; hint?: string }) {
  return (
    <Box flexDirection="column" padding={1}>
      <Text color={theme.colors.error}>error: {message}</Text>
      {hint && (
        <Box marginTop={1}>
          <Text dimColor>run </Text>
          <Text color={theme.colors.accent}>{hint}</Text>
          <Text dimColor> for help</Text>
        </Box>
      )}
    </Box>
  );
}

export const runCmd = defineCommand({
  meta: {
    name: "run",
    description: "run a model, action, or skill",
  },
  args: {
    target: {
      type: "positional",
      description: "what to run",
      required: false,
    },
    info: { type: "boolean", description: "show info" },
    schema: { type: "boolean", description: "show schema as json" },
    json: { type: "boolean", description: "output result as json" },
    quiet: { type: "boolean", description: "minimal output" },
  },
  async run({ rawArgs }) {
    const { target, options } = parseArgs(rawArgs);

    if (!target) {
      renderStatic(<ErrorView message="target required" hint="varg list" />);
      process.exit(1);
    }

    // Resolve the target
    const result = resolve(target, { fuzzy: true });

    if (!result.definition) {
      renderStatic(
        <Box flexDirection="column" padding={1}>
          <Text color={theme.colors.error}>error: '{target}' not found</Text>
          {result.suggestions && result.suggestions.length > 0 && (
            <Box marginTop={1}>
              <Text>
                did you mean: {result.suggestions.slice(0, 3).join(", ")}?
              </Text>
            </Box>
          )}
          <Box marginTop={1}>
            <Text dimColor>run </Text>
            <Text color={theme.colors.accent}>varg list</Text>
            <Text dimColor> to see available targets</Text>
          </Box>
        </Box>,
      );
      process.exit(1);
    }

    const item = result.definition;

    if (options.info) {
      renderStatic(<HelpView item={item} />);
      return;
    }

    if (options.schema) {
      const schema = {
        name: item.name,
        type: item.type,
        description: item.description,
        input: toJsonSchema(item.schema.input),
        output: toJsonSchema(item.schema.output),
      };
      console.log(JSON.stringify(schema, null, 2));
      return;
    }

    // Get schema info for validation
    const { properties, required } = getCliSchemaInfo(item.schema.input);

    // Validate required args
    for (const req of required) {
      if (!options[req]) {
        renderStatic(
          <ErrorView
            message={`--${req} is required`}
            hint={`varg run ${target} --info`}
          />,
        );
        process.exit(1);
      }
    }

    // Build params for display
    const params: Record<string, string> = {};
    for (const key of Object.keys(properties)) {
      if (options[key] && typeof options[key] === "string") {
        params[key] = options[key] as string;
      }
    }

    const startTime = Date.now();

    // For quiet/json modes, no UI
    if (options.quiet || options.json) {
      try {
        const inputs: Record<string, unknown> = {};
        for (const key of Object.keys(properties)) {
          if (options[key] !== undefined) {
            inputs[key] = options[key];
          }
        }

        const execResult = await executor.run(target, inputs, {
          provider: options.provider,
        });

        const elapsed = Date.now() - startTime;

        if (options.json) {
          console.log(
            JSON.stringify({
              success: true,
              result: execResult,
              time: elapsed,
            }),
          );
        } else {
          console.log(JSON.stringify(execResult.output));
        }
      } catch (err) {
        const elapsed = Date.now() - startTime;
        const errorMsg = err instanceof Error ? err.message : String(err);

        if (options.json) {
          console.log(
            JSON.stringify({ success: false, error: errorMsg, time: elapsed }),
          );
        } else {
          console.error(errorMsg);
        }
        process.exit(1);
      }
      return;
    }

    // Interactive mode with live status
    const { rerender, unmount } = renderLive(
      <StatusBox title={target} status="running" params={params} />,
    );

    try {
      const inputs: Record<string, unknown> = {};
      for (const key of Object.keys(properties)) {
        if (options[key] !== undefined) {
          inputs[key] = options[key];
        }
      }

      const execResult = await executor.run(target, inputs, {
        provider: options.provider,
      });

      const elapsed = Date.now() - startTime;

      // Extract URL from result
      const output = execResult.output as Record<string, unknown> | string;
      const url =
        typeof output === "string"
          ? output
          : (output?.imageUrl as string) ||
            (output?.videoUrl as string) ||
            (output?.url as string) ||
            null;

      // Clear and show done state
      process.stdout.write("\x1b[2J\x1b[H");

      rerender(
        <Box flexDirection="column">
          <StatusBox
            title={target}
            status="done"
            params={params}
            output={url ? "saved" : "done"}
            duration={elapsed}
          />
          {url && (
            <Box marginTop={1} paddingLeft={1}>
              <Text color={theme.colors.accent}>url</Text>
              <Text> {url}</Text>
            </Box>
          )}
        </Box>,
      );

      // Allow render to complete then unmount
      setTimeout(() => unmount(), 100);
    } catch (err) {
      const elapsed = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : String(err);

      process.stdout.write("\x1b[2J\x1b[H");

      rerender(
        <StatusBox
          title={target}
          status="error"
          params={params}
          error={errorMsg}
          duration={elapsed}
        />,
      );

      setTimeout(() => {
        unmount();
        process.exit(1);
      }, 100);
    }
  },
});
