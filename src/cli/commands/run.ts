/**
 * varg run command
 * Execute actions, models, or skills via the executor
 */

import { existsSync } from "node:fs";
import { defineCommand } from "citty";
import { executor } from "../../core/executor";
import { registry } from "../../core/registry";
import { resolve } from "../../core/registry/resolver";
import type { Definition } from "../../core/schema/types";
import { box, c, runningBox } from "../output";

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

function showHelp(item: Definition) {
  const content: string[] = [];
  content.push("");
  content.push(`  ${item.description}`);
  content.push("");
  content.push(c.bold(c.dim("  USAGE")));
  content.push("");

  const required = item.schema.input.required;
  const reqArgs = required.map((r) => `--${r} <${r}>`).join(" ");
  content.push(`    varg run ${item.name} ${reqArgs} [options]`);

  content.push("");
  content.push(c.bold(c.dim("  OPTIONS")));
  content.push("");

  for (const [key, prop] of Object.entries(item.schema.input.properties)) {
    const req = item.schema.input.required.includes(key);
    const reqTag = req ? c.yellow(" (required)") : "";
    const defaultVal =
      prop.default !== undefined ? c.dim(` default: ${prop.default}`) : "";
    const enumVals = prop.enum ? c.dim(` [${prop.enum.join(", ")}]`) : "";

    content.push(
      `    --${key.padEnd(12)}${prop.description}${reqTag}${defaultVal}${enumVals}`,
    );
  }

  content.push("");

  // Show provider options for models
  if (item.type === "model") {
    content.push(`    --provider      override default provider`);
    content.push(
      c.dim(`                    available: ${item.providers.join(", ")}`),
    );
    content.push("");
  }

  content.push(`    --json          output result as json`);
  content.push(`    --quiet         minimal output`);
  content.push(`    --info          show this help`);
  content.push("");

  console.log(box(`${item.type}: ${item.name}`, content));
}

function showSchema(item: Definition) {
  const schema = {
    name: item.name,
    type: item.type,
    description: item.description,
    input: item.schema.input,
    output: item.schema.output,
  };

  console.log(JSON.stringify(schema, null, 2));
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
    info: {
      type: "boolean",
      description: "show info",
    },
    schema: {
      type: "boolean",
      description: "show schema as json",
    },
    json: {
      type: "boolean",
      description: "output result as json",
    },
    quiet: {
      type: "boolean",
      description: "minimal output",
    },
  },
  async run({ rawArgs }) {
    const { target, options } = parseArgs(rawArgs);

    if (!target) {
      console.error(`${c.red("error:")} target required`);
      console.log(`\nusage: ${c.cyan("varg run <target> [options]")}`);
      console.log(`\nrun ${c.cyan("varg list")} to see available targets`);
      process.exit(1);
    }

    // Resolve the target
    const result = resolve(target, { fuzzy: true });

    if (!result.definition) {
      console.error(`${c.red("error:")} '${target}' not found`);
      if (result.suggestions && result.suggestions.length > 0) {
        console.log(
          `\ndid you mean: ${result.suggestions.slice(0, 3).join(", ")}?`,
        );
      }
      console.log(`\nrun ${c.cyan("varg list")} to see available targets`);
      process.exit(1);
    }

    const item = result.definition;

    if (options.info) {
      showHelp(item);
      return;
    }

    if (options.schema) {
      showSchema(item);
      return;
    }

    // Validate required args
    for (const req of item.schema.input.required) {
      if (!options[req]) {
        console.error(`${c.red("error:")} --${req} is required`);
        console.log(`\nrun ${c.cyan(`varg run ${target} --info`)} for usage`);
        process.exit(1);
      }
    }

    // Build params for display
    const params: Record<string, string> = {};
    for (const key of Object.keys(item.schema.input.properties)) {
      if (options[key] && typeof options[key] === "string") {
        params[key] = options[key] as string;
      }
    }

    if (!options.quiet && !options.json) {
      console.log(runningBox(target, params, "running"));
    }

    const startTime = Date.now();

    try {
      // Build inputs for executor
      const inputs: Record<string, unknown> = {};
      for (const key of Object.keys(item.schema.input.properties)) {
        if (options[key] !== undefined) {
          inputs[key] = options[key];
        }
      }

      // Run via executor
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
      } else if (options.quiet) {
        console.log(JSON.stringify(execResult.output));
      } else {
        // Extract URL from result if present
        const output = execResult.output as Record<string, unknown> | string;
        const url =
          typeof output === "string"
            ? output
            : output?.imageUrl || output?.videoUrl || output?.url || null;

        console.log("\x1b[2J\x1b[H");
        console.log(
          runningBox(target, params, "done", {
            output: url ? "saved" : "done",
            time: elapsed,
          }),
        );

        // Print URL outside box so it's clickable
        if (url) {
          console.log(`\n  ${c.cyan("url")}  ${url}\n`);
        }
      }
    } catch (err) {
      const elapsed = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : String(err);

      if (options.json) {
        console.log(
          JSON.stringify({ success: false, error: errorMsg, time: elapsed }),
        );
      } else if (options.quiet) {
        console.error(errorMsg);
      } else {
        console.log("\x1b[2J\x1b[H");
        console.log(
          runningBox(target, params, "error", {
            error: errorMsg,
            time: elapsed,
          }),
        );
      }

      process.exit(1);
    }
  },
});
