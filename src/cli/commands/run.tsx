/**
 * varg run command
 * Ink-based execution with live status updates
 */

import { existsSync } from "node:fs";
import { defineCommand } from "citty";
import { Box, Text } from "ink";
import { executor } from "../../core/executor/index.ts";
import { resolve } from "../../core/registry/resolver.ts";
import {
  coerceCliValue,
  getCliSchemaInfo,
  toJsonSchema,
} from "../../core/schema/helpers.ts";
import type { Definition } from "../../core/schema/types.ts";
import {
  Header,
  OptionRow,
  StatusBox,
  VargBox,
  VargText,
} from "../ui/index.ts";
import { renderLive, renderStatic } from "../ui/render.ts";
import { theme } from "../ui/theme.ts";

/**
 * Extract detailed error message from provider errors
 * Handles fal.ai ApiError, Replicate errors, and generic errors
 */
function extractErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) {
    return String(err);
  }

  // Check for fal.ai ApiError with body details
  const apiError = err as Error & {
    body?: { detail?: string | Array<{ msg: string; loc: string[] }> };
    status?: number;
  };

  if (apiError.body?.detail) {
    // Handle validation errors (array of field errors)
    if (Array.isArray(apiError.body.detail)) {
      return apiError.body.detail
        .map((e) => `${e.loc?.join(".") || "field"}: ${e.msg}`)
        .join("; ");
    }
    // Handle string detail
    if (typeof apiError.body.detail === "string") {
      return apiError.body.detail;
    }
  }

  // Check for body as string or with message
  if (apiError.body) {
    const body = apiError.body as Record<string, unknown>;
    if (body.message && typeof body.message === "string") {
      return body.message;
    }
    if (body.error && typeof body.error === "string") {
      return body.error;
    }
  }

  // Add status code context if available
  if (apiError.status && apiError.message) {
    return `${apiError.message} (${apiError.status})`;
  }

  return err.message;
}

function sanitizeOutput(_key: string, value: unknown): unknown {
  if (value instanceof Buffer) {
    return `<Buffer ${value.length} bytes>`;
  }
  if (
    value &&
    typeof value === "object" &&
    "type" in value &&
    (value as { type: string }).type === "Buffer" &&
    "data" in value
  ) {
    const data = (value as { data: unknown[] }).data;
    return `<Buffer ${Array.isArray(data) ? data.length : "?"} bytes>`;
  }
  return value;
}

interface RunOptions {
  [key: string]: string | boolean | undefined;
  help?: boolean;
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

    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg.startsWith("--")) {
      const key = arg.slice(2);
      if (["schema", "json", "quiet"].includes(key)) {
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
  // Only show truly required args (no default value)
  const trulyRequired = required.filter(
    (r) => properties[r]?.default === undefined,
  );
  const reqArgs = trulyRequired.map((r) => `--${r} <${r}>`).join(" ");

  return (
    <VargBox title={`${item.type}: ${item.name}`}>
      <Box marginBottom={1}>
        <Text wrap="wrap">{item.description}</Text>
      </Box>

      <Header>USAGE</Header>
      <Box paddingLeft={2} marginBottom={1}>
        <VargText variant="accent">
          varg run {item.name} {reqArgs} [options]
        </VargText>
      </Box>

      <Header>OPTIONS</Header>
      <Box flexDirection="column" paddingLeft={2} marginBottom={1}>
        {Object.entries(properties).map(([key, prop]) => {
          const hasDefault = prop.default !== undefined;
          return (
            <OptionRow
              key={key}
              name={key}
              description={prop.description}
              required={required.includes(key) && !hasDefault}
              defaultValue={prop.default}
              enumValues={prop.enum}
              type={prop.type}
            />
          );
        })}
      </Box>

      {item.type === "model" && (
        <Box flexDirection="column" paddingLeft={2} marginBottom={1}>
          <OptionRow name="provider" description="override default provider" />
          <Box paddingLeft={theme.layout.optionNameWidth}>
            <Text dimColor>available: {item.providers.join(", ")}</Text>
          </Box>
        </Box>
      )}

      <Header>GLOBAL OPTIONS</Header>
      <Box flexDirection="column" paddingLeft={2}>
        <OptionRow name="json" description="output result as json" />
        <OptionRow name="quiet" description="minimal output" />
        <OptionRow name="help, -h" description="show this help" />
      </Box>
    </VargBox>
  );
}

function ErrorView({ message, hint }: { message: string; hint?: string }) {
  return (
    <Box flexDirection="column" padding={1}>
      <VargText variant="error">error: {message}</VargText>
      {hint && (
        <Box marginTop={1}>
          <VargText variant="muted">run </VargText>
          <VargText variant="accent">{hint}</VargText>
          <VargText variant="muted"> for help</VargText>
        </Box>
      )}
    </Box>
  );
}

/** Help view for run command without target */
function RunHelpView() {
  return (
    <VargBox title="varg run">
      <Box marginBottom={1}>
        <Text>run a model, action, or skill</Text>
      </Box>

      <Header>USAGE</Header>
      <Box paddingLeft={2} marginBottom={1}>
        <VargText variant="accent">varg run {"<target>"} [--options]</VargText>
      </Box>

      <Header>OPTIONS</Header>
      <Box flexDirection="column" paddingLeft={2} marginBottom={1}>
        <Text>--json output result as json</Text>
        <Text>--quiet minimal output</Text>
        <Text>--schema show target schema as json</Text>
        <Text>--provider override default provider (models only)</Text>
        <Text>--help, -h show this help</Text>
      </Box>

      <Header>EXAMPLES</Header>
      <Box flexDirection="column" paddingLeft={2}>
        <Box flexDirection="column" marginBottom={1}>
          <Text dimColor># generate a video from text</Text>
          <VargText variant="accent">
            varg run video --prompt "ocean waves"
          </VargText>
        </Box>
        <Box flexDirection="column" marginBottom={1}>
          <Text dimColor># get help for a specific target</Text>
          <VargText variant="accent">varg run video --help</VargText>
        </Box>
        <Box flexDirection="column">
          <Text dimColor># see available targets</Text>
          <VargText variant="accent">varg list</VargText>
        </Box>
      </Box>
    </VargBox>
  );
}

/** Show run command help */
export function showRunHelp() {
  renderStatic(<RunHelpView />);
}

/** Show target-specific help */
export function showTargetHelp(target: string): boolean {
  const result = resolve(target, { fuzzy: true });
  if (result.definition) {
    renderStatic(<HelpView item={result.definition} />);
    return true;
  }
  return false;
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
    schema: { type: "boolean", description: "show schema as json" },
    json: { type: "boolean", description: "output result as json" },
    quiet: { type: "boolean", description: "minimal output" },
  },
  async run({ rawArgs }) {
    const { target, options } = parseArgs(rawArgs);

    // Show run help when no target or --help without target
    if (!target || (options.help && !target)) {
      showRunHelp();
      return;
    }

    // Resolve the target
    const result = resolve(target, { fuzzy: true });

    if (!result.definition) {
      renderStatic(
        <Box flexDirection="column" padding={1}>
          <VargText variant="error">error: '{target}' not found</VargText>
          {result.suggestions && result.suggestions.length > 0 && (
            <Box marginTop={1}>
              <Text>
                did you mean: {result.suggestions.slice(0, 3).join(", ")}?
              </Text>
            </Box>
          )}
          <Box marginTop={1}>
            <VargText variant="muted">run </VargText>
            <VargText variant="accent">varg list</VargText>
            <VargText variant="muted"> to see available targets</VargText>
          </Box>
        </Box>,
      );
      process.exit(1);
    }

    const item = result.definition;

    // Show target-specific help
    if (options.help) {
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

    // Validate required args (skip fields with default values)
    for (const req of required) {
      const prop = properties[req];
      const hasDefault = prop?.default !== undefined;
      if (!options[req] && !hasDefault) {
        renderStatic(
          <ErrorView
            message={`--${req} is required`}
            hint={`varg run ${target} --help`}
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
          const value = options[key];
          if (value !== undefined) {
            const prop = properties[key];
            inputs[key] =
              typeof value === "string" && prop
                ? coerceCliValue(value, prop)
                : value;
          }
        }

        const execResult = await executor.run(target, inputs, {
          provider: options.provider,
        });

        const elapsed = Date.now() - startTime;

        if (options.json) {
          console.log(
            JSON.stringify(
              {
                success: true,
                result: execResult,
                time: elapsed,
              },
              sanitizeOutput,
            ),
          );
        } else {
          console.log(JSON.stringify(execResult.output, sanitizeOutput));
        }
      } catch (err) {
        const elapsed = Date.now() - startTime;
        const errorMsg = extractErrorMessage(err);

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
        const value = options[key];
        if (value !== undefined) {
          const prop = properties[key];
          inputs[key] =
            typeof value === "string" && prop
              ? coerceCliValue(value, prop)
              : value;
        }
      }

      const execResult = await executor.run(target, inputs, {
        provider: options.provider,
      });

      const elapsed = Date.now() - startTime;

      // Extract URL from result
      const output = execResult.output as Record<string, unknown> | string;
      let url: string | null = null;

      if (typeof output === "string") {
        url = output;
      } else if (output) {
        // Try common URL fields
        url =
          (output.imageUrl as string) ||
          (output.videoUrl as string) ||
          (output.url as string) ||
          null;

        // Handle images array (nano-banana-pro, flux, etc.)
        if (!url && Array.isArray(output.images) && output.images.length > 0) {
          const firstImage = output.images[0] as Record<string, unknown>;
          url = (firstImage?.url as string) || null;
        }

        // Handle video object
        if (!url && output.video && typeof output.video === "object") {
          url = (output.video as Record<string, unknown>).url as string;
        }
      }

      // Clear and show done state
      process.stdout.write("\x1b[2J\x1b[H");

      rerender(
        <Box flexDirection="column">
          <StatusBox
            title={target}
            status="done"
            params={params}
            output={url ? url : "done"}
            duration={elapsed}
          />
        </Box>,
      );

      // Also log the URL to console for easy copying
      if (url) {
        console.log(`\n${url}`);
      }

      // Allow render to complete then unmount
      setTimeout(() => unmount(), 100);
    } catch (err) {
      const elapsed = Date.now() - startTime;
      const errorMsg = extractErrorMessage(err);

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
