import { existsSync } from "node:fs";
import { defineCommand } from "citty";
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

function extractErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) {
    return String(err);
  }

  const apiError = err as Error & {
    body?: { detail?: string | Array<{ msg: string; loc: string[] }> };
    status?: number;
  };

  if (apiError.body?.detail) {
    if (Array.isArray(apiError.body.detail)) {
      return apiError.body.detail
        .map((e) => `${e.loc?.join(".") || "field"}: ${e.msg}`)
        .join("; ");
    }
    if (typeof apiError.body.detail === "string") {
      return apiError.body.detail;
    }
  }

  if (apiError.body) {
    const body = apiError.body as Record<string, unknown>;
    if (body.message && typeof body.message === "string") {
      return body.message;
    }
    if (body.error && typeof body.error === "string") {
      return body.error;
    }
  }

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
  const trulyRequired = required.filter(
    (r) => properties[r]?.default === undefined,
  );
  const reqArgs = trulyRequired.map((r) => `--${r} <${r}>`).join(" ");

  return (
    <VargBox title={`${item.type}: ${item.name}`}>
      <box style={{ marginBottom: 1 }}>
        <text>{item.description}</text>
      </box>

      <Header>USAGE</Header>
      <box style={{ paddingLeft: 2, marginBottom: 1 }}>
        <VargText variant="accent">
          varg run {item.name} {reqArgs} [options]
        </VargText>
      </box>

      <Header>OPTIONS</Header>
      <box style={{ flexDirection: "column", paddingLeft: 2, marginBottom: 1 }}>
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
      </box>

      {item.type === "model" && (
        <box
          style={{ flexDirection: "column", paddingLeft: 2, marginBottom: 1 }}
        >
          <OptionRow name="provider" description="override default provider" />
          <box style={{ paddingLeft: theme.layout.optionNameWidth }}>
            <text fg="gray">available: {item.providers.join(", ")}</text>
          </box>
        </box>
      )}

      <Header>GLOBAL OPTIONS</Header>
      <box style={{ flexDirection: "column", paddingLeft: 2 }}>
        <OptionRow name="json" description="output result as json" />
        <OptionRow name="quiet" description="minimal output" />
        <OptionRow name="help, -h" description="show this help" />
      </box>
    </VargBox>
  );
}

function ErrorView({ message, hint }: { message: string; hint?: string }) {
  return (
    <box style={{ flexDirection: "column", padding: 1 }}>
      <VargText variant="error">error: {message}</VargText>
      {hint && (
        <box style={{ marginTop: 1 }}>
          <VargText variant="muted">run </VargText>
          <VargText variant="accent">{hint}</VargText>
          <VargText variant="muted"> for help</VargText>
        </box>
      )}
    </box>
  );
}

function RunHelpView() {
  return (
    <VargBox title="varg run">
      <box style={{ marginBottom: 1 }}>
        <text>run a model, action, or skill</text>
      </box>

      <Header>USAGE</Header>
      <box style={{ paddingLeft: 2, marginBottom: 1 }}>
        <VargText variant="accent">varg run {"<target>"} [--options]</VargText>
      </box>

      <Header>OPTIONS</Header>
      <box style={{ flexDirection: "column", paddingLeft: 2, marginBottom: 1 }}>
        <text>--json output result as json</text>
        <text>--quiet minimal output</text>
        <text>--schema show target schema as json</text>
        <text>--provider override default provider (models only)</text>
        <text>--help, -h show this help</text>
      </box>

      <Header>EXAMPLES</Header>
      <box style={{ flexDirection: "column", paddingLeft: 2 }}>
        <box style={{ flexDirection: "column", marginBottom: 1 }}>
          <text fg="gray"># generate a video from text</text>
          <VargText variant="accent">
            varg run video --prompt "ocean waves"
          </VargText>
        </box>
        <box style={{ flexDirection: "column", marginBottom: 1 }}>
          <text fg="gray"># get help for a specific target</text>
          <VargText variant="accent">varg run video --help</VargText>
        </box>
        <box style={{ flexDirection: "column" }}>
          <text fg="gray"># see available targets</text>
          <VargText variant="accent">varg list</VargText>
        </box>
      </box>
    </VargBox>
  );
}

export function showRunHelp() {
  renderStatic(<RunHelpView />);
}

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

    if (!target || (options.help && !target)) {
      showRunHelp();
      return;
    }

    const result = resolve(target, { fuzzy: true });

    if (!result.definition) {
      renderStatic(
        <box style={{ flexDirection: "column", padding: 1 }}>
          <VargText variant="error">error: '{target}' not found</VargText>
          {result.suggestions && result.suggestions.length > 0 && (
            <box style={{ marginTop: 1 }}>
              <text>
                did you mean: {result.suggestions.slice(0, 3).join(", ")}?
              </text>
            </box>
          )}
          <box style={{ marginTop: 1 }}>
            <VargText variant="muted">run </VargText>
            <VargText variant="accent">varg list</VargText>
            <VargText variant="muted"> to see available targets</VargText>
          </box>
        </box>,
      );
      process.exit(1);
    }

    const item = result.definition;

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

    const { properties, required } = getCliSchemaInfo(item.schema.input);

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

    const params: Record<string, string> = {};
    for (const key of Object.keys(properties)) {
      if (options[key] && typeof options[key] === "string") {
        params[key] = options[key] as string;
      }
    }

    const startTime = Date.now();

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

    const { rerender, unmount } = await renderLive(
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

      const output = execResult.output as Record<string, unknown> | string;
      let url: string | null = null;

      if (typeof output === "string") {
        url = output;
      } else if (output) {
        url =
          (output.imageUrl as string) ||
          (output.videoUrl as string) ||
          (output.url as string) ||
          null;

        if (!url && Array.isArray(output.images) && output.images.length > 0) {
          const firstImage = output.images[0] as Record<string, unknown>;
          url = (firstImage?.url as string) || null;
        }

        if (!url && output.video && typeof output.video === "object") {
          url = (output.video as Record<string, unknown>).url as string;
        }
      }

      process.stdout.write("\x1b[2J\x1b[H");

      rerender(
        <box style={{ flexDirection: "column" }}>
          <StatusBox
            title={target}
            status="done"
            params={params}
            output={url ? url : "done"}
            duration={elapsed}
          />
        </box>,
      );

      if (url) {
        console.log(`\n${url}`);
      }

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
